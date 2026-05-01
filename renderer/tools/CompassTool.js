// CompassTool — draw circles and arcs by setting center + radius
// Click to set center, drag to set radius, optional angle constraints

export class CompassTool {
  constructor() {
    this.isDrawing = false;
    this.center = null;
    this.previewObject = null;
  }

  onPointerDown(pos, context) {
    this.isDrawing = true;
    this.center = { x: pos.x, y: pos.y };
    this.previewObject = null;
  }

  onPointerMove(pos, context) {
    if (!this.isDrawing || !this.center) return;

    const toolState = context.toolStore.getState();
    const dx = pos.x - this.center.x;
    const dy = pos.y - this.center.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    // Determine arc angles
    const startAngle = toolState.compassFullCircle ? 0 : (toolState.compassStartAngle || 0);
    const endAngle = toolState.compassFullCircle ? Math.PI * 2 : (toolState.compassEndAngle || Math.PI * 2);

    this.previewObject = {
      type: 'compass',
      cx: this.center.x,
      cy: this.center.y,
      radius,
      startAngle,
      endAngle,
      color: toolState.penColor || '#1A1A1A',
      lineWidth: toolState.penWidth || 2,
      fill: toolState.shapeFill || false,
      fillColor: toolState.shapeFillColor || 'transparent'
    };
  }

  onPointerUp(pos, context) {
    if (!this.isDrawing || !this.center) return;
    this.isDrawing = false;

    const dx = pos.x - this.center.x;
    const dy = pos.y - this.center.y;
    const radius = Math.sqrt(dx * dx + dy * dy);

    // Minimum radius threshold
    if (radius < 5) {
      this.previewObject = null;
      this.center = null;
      return;
    }

    const toolState = context.toolStore.getState();
    const startAngle = toolState.compassFullCircle ? 0 : (toolState.compassStartAngle || 0);
    const endAngle = toolState.compassFullCircle ? Math.PI * 2 : (toolState.compassEndAngle || Math.PI * 2);

    const { generateId } = require('../utils/uuid');
    const obj = {
      id: generateId(),
      type: 'compass',
      cx: this.center.x,
      cy: this.center.y,
      radius,
      startAngle,
      endAngle,
      color: toolState.penColor || '#1A1A1A',
      lineWidth: toolState.penWidth || 2,
      fill: toolState.shapeFill || false,
      fillColor: toolState.shapeFillColor || 'transparent',
      bounds: {
        x: this.center.x - radius,
        y: this.center.y - radius,
        w: radius * 2,
        h: radius * 2
      },
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
      locked: false
    };

    context.store.getState().addObject(obj);
    this.previewObject = null;
    this.center = null;
  }
}
