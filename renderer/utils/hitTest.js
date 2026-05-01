import { distance, pointInRect, expandBounds, getBounds, rotatePoint } from './geometry';

// Hit test: is a point near any segment of a stroke?
export function hitTestStroke(px, py, stroke, threshold = 5) {
  const points = stroke.points;
  if (!points || points.length === 0) return false;

  const halfWidth = (stroke.width || 2) / 2 + threshold;

  for (let i = 0; i < points.length - 1; i++) {
    if (pointToSegmentDistance(px, py, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y) < halfWidth) {
      return true;
    }
  }

  // Single point check
  if (points.length === 1) {
    return distance({ x: px, y: py }, points[0]) < halfWidth;
  }

  return false;
}

// Hit test: is point inside a shape?
export function hitTestShape(px, py, shape) {
  const b = getObjectBounds(shape);
  if (!b) return false;

  // If rotated, transform the test point into the shape's local space
  const rotation = shape.transform?.rotation || 0;
  let testX = px, testY = py;
  if (rotation !== 0) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rotated = rotatePoint(px, py, cx, cy, -rotation);
    testX = rotated.x;
    testY = rotated.y;
  }

  if (shape.shapeType === 'ellipse') {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const rx = b.w / 2;
    const ry = b.h / 2;
    if (rx === 0 || ry === 0) return false;
    const dx = (testX - cx) / rx;
    const dy = (testY - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  // Rectangle / triangle / fallback: AABB test
  return pointInRect(testX, testY, b);
}

// Hit test: is point inside a text object's bounding box?
export function hitTestText(px, py, textObj) {
  const b = getObjectBounds(textObj);
  if (!b) return false;
  return pointInRect(px, py, b);
}

// Hit test: is point inside an image object's bounding box?
export function hitTestImage(px, py, imageObj) {
  const b = getObjectBounds(imageObj);
  if (!b) return false;
  return pointInRect(px, py, b);
}

// Generic hit test dispatcher based on object type
export function hitTestObject(px, py, obj) {
  switch (obj.type) {
    case 'stroke':
      return hitTestStroke(px, py, obj);
    case 'shape':
    case 'line':
      return hitTestShape(px, py, obj);
    case 'text':
      return hitTestText(px, py, obj);
    case 'image':
    case 'pdf':
      return hitTestImage(px, py, obj);
    default:
      return false;
  }
}

// Find the topmost object at a point (highest zIndex first)
export function findObjectAtPoint(px, py, objects) {
  // Iterate in reverse (highest zIndex last in array, or sort)
  const sorted = [...objects].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
  for (const obj of sorted) {
    if (obj.locked || !obj.visible) continue;
    if (hitTestObject(px, py, obj)) return obj;
  }
  return null;
}

// Find all objects within a selection rectangle
export function findObjectsInRect(rect, objects) {
  const result = [];
  for (const obj of objects) {
    if (obj.locked || !obj.visible) continue;
    const b = getObjectBounds(obj);
    if (!b) continue;
    // Check if object bounds overlap with selection rect
    if (b.x < rect.x + rect.w && b.x + b.w > rect.x && b.y < rect.y + rect.h && b.y + b.h > rect.y) {
      result.push(obj);
    }
  }
  return result;
}

// Get effective bounds of an object including transforms
export function getObjectBounds(obj) {
  if (!obj) return null;

  let bounds = obj.bounds;
  if (!bounds && obj.type === 'stroke' && obj.points) {
    bounds = getBounds(obj.points);
    bounds = expandBounds(bounds, (obj.width || 2) / 2);
  }
  if (!bounds) return null;

  const tx = obj.transform?.translateX || 0;
  const ty = obj.transform?.translateY || 0;
  const sx = obj.transform?.scaleX || 1;
  const sy = obj.transform?.scaleY || 1;

  return {
    x: bounds.x + tx,
    y: bounds.y + ty,
    w: bounds.w * sx,
    h: bounds.h * sy
  };
}

// Distance from point to line segment
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) return distance({ x: px, y: py }, { x: x1, y: y1 });

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return distance({ x: px, y: py }, { x: projX, y: projY });
}

// Check which transform handle is under cursor (returns handle name or null)
export function hitTestTransformHandles(px, py, bounds, handleSize = 8) {
  if (!bounds) return null;
  const hs = handleSize;
  const { x, y, w, h } = bounds;

  const handles = {
    'nw': { x: x - hs/2, y: y - hs/2 },
    'n':  { x: x + w/2 - hs/2, y: y - hs/2 },
    'ne': { x: x + w - hs/2, y: y - hs/2 },
    'e':  { x: x + w - hs/2, y: y + h/2 - hs/2 },
    'se': { x: x + w - hs/2, y: y + h - hs/2 },
    's':  { x: x + w/2 - hs/2, y: y + h - hs/2 },
    'sw': { x: x - hs/2, y: y + h - hs/2 },
    'w':  { x: x - hs/2, y: y + h/2 - hs/2 },
    'rotate': { x: x + w/2 - hs/2, y: y - 20 - hs/2 }
  };

  for (const [name, pos] of Object.entries(handles)) {
    if (pointInRect(px, py, { x: pos.x, y: pos.y, w: hs, h: hs })) {
      return name;
    }
  }

  return null;
}
