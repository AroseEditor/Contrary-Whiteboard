// Command History — manages undo/redo stack with command pattern
export class CommandHistory {
  constructor(maxSize = 200) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);

    // Trim if exceeded max
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }

    // Executing a new command invalidates redo stack
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  setMaxSize(size) {
    this.maxSize = size;
    while (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }
}
