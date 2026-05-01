export class TextTool {
  constructor() {
    this.showTextInput = false;
    this.previewObject = null;
  }

  onPointerDown(pos, context) {
    // Signal PageCanvas to show text input overlay at this position
    this.showTextInput = true;
  }

  onPointerMove(pos, context) {
    // No-op for text tool
  }

  onPointerUp(pos, context) {
    this.showTextInput = false;
  }
}
