export class LaserTool {
  constructor() {
    this.isActive = false;
    this.points = [];
    this.previewObject = null;
    this.cleanupInterval = null;
  }

  onPointerDown(pos, context) {
    this.isActive = true;
    this.points = [{ x: pos.x, y: pos.y, time: Date.now() }];

    // Start cleanup interval to remove old points
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        const now = Date.now();
        this.points = this.points.filter(p => now - p.time < 1000);
        if (this.points.length === 0 && !this.isActive) {
          clearInterval(this.cleanupInterval);
          this.cleanupInterval = null;
        }
      }, 50);
    }
  }

  onPointerMove(pos, context) {
    if (!this.isActive) return;

    this.points.push({ x: pos.x, y: pos.y, time: Date.now() });

    // Cap points array to prevent memory bloat
    if (this.points.length > 500) {
      this.points = this.points.slice(-250);
    }
  }

  onPointerUp(pos, context) {
    this.isActive = false;
    // Points will fade out via the cleanup interval
  }
}
