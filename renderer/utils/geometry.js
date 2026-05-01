// Distance between two points
export function distance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Midpoint
export function midpoint(p1, p2) {
  return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
}

// Angle between two points in radians
export function angle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

// Degrees to radians
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

// Radians to degrees
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

// Snap angle to nearest increment
export function snapAngle(angleDeg, increment) {
  return Math.round(angleDeg / increment) * increment;
}

// Check if point is inside rectangle bounds
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

// Check if two rects overlap (AABB intersection)
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Get bounding box of a set of points
export function getBounds(points) {
  if (!points || points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Expand bounds by padding
export function expandBounds(bounds, pad) {
  return {
    x: bounds.x - pad,
    y: bounds.y - pad,
    w: bounds.w + pad * 2,
    h: bounds.h + pad * 2
  };
}

// Rotate point around center
export function rotatePoint(px, py, cx, cy, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  };
}

// Clamp value
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Linear interpolation
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Constrain angle to 0/45/90 multiples when shift is held
export function constrainLine(startX, startY, endX, endY) {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ang = Math.atan2(dy, dx);
  const snapped = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
  return {
    x: startX + len * Math.cos(snapped),
    y: startY + len * Math.sin(snapped)
  };
}
