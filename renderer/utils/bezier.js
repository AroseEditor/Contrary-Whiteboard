// Simplify a polyline using Ramer-Douglas-Peucker algorithm
export function simplifyPath(points, tolerance = 1.0) {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(points.slice(maxIdx), tolerance);
    return left.slice(0, -1).concat(right);
  }

  return [start, end];
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    const ex = point.x - lineStart.x;
    const ey = point.y - lineStart.y;
    return Math.sqrt(ex * ex + ey * ey);
  }

  const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  const ex = point.x - projX;
  const ey = point.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

// Convert raw points to smoothed quadratic bezier points for canvas rendering
// Returns array of {type: 'M'|'Q'|'L', points: [...]}
export function smoothPoints(points) {
  if (points.length === 0) return [];
  if (points.length === 1) return [{ type: 'M', x: points[0].x, y: points[0].y }];
  if (points.length === 2) {
    return [
      { type: 'M', x: points[0].x, y: points[0].y },
      { type: 'L', x: points[1].x, y: points[1].y }
    ];
  }

  const result = [{ type: 'M', x: points[0].x, y: points[0].y }];

  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    result.push({
      type: 'Q',
      cpx: points[i].x,
      cpy: points[i].y,
      x: mx,
      y: my
    });
  }

  // Final point
  const last = points[points.length - 1];
  result.push({ type: 'L', x: last.x, y: last.y });

  return result;
}

// Calculate velocity-based width for pressure simulation
export function getVelocityWidth(p1, p2, baseWidth, minRatio = 0.3, maxRatio = 1.0) {
  if (!p1 || !p2) return baseWidth;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dt = (p2.time || 0) - (p1.time || 0);

  if (dt === 0) return baseWidth;

  const dist = Math.sqrt(dx * dx + dy * dy);
  const velocity = dist / dt; // pixels per ms

  // High velocity = thin, low velocity = thick
  const factor = Math.max(minRatio, Math.min(maxRatio, 1.0 - velocity * 0.01));
  return baseWidth * factor;
}

// Build a canvas Path2D from smooth points
export function buildPath(points) {
  if (points.length < 2) return null;

  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    path.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }

  const last = points[points.length - 1];
  path.lineTo(last.x, last.y);

  return path;
}
