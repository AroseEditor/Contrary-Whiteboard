export class MoveObjectCommand {
  constructor(store, pageId, objectIds, dx, dy) {
    this.store = store;
    this.pageId = pageId;
    this.objectIds = objectIds;
    this.dx = dx;
    this.dy = dy;
  }

  execute() {
    this._applyDelta(this.dx, this.dy);
  }

  undo() {
    this._applyDelta(-this.dx, -this.dy);
  }

  _applyDelta(dx, dy) {
    const state = this.store.getState();
    const pages = state.pages.map(p => {
      if (p.id === this.pageId) {
        const objects = p.objects.map(o => {
          if (this.objectIds.includes(o.id)) {
            const transform = { ...o.transform };
            transform.translateX = (transform.translateX || 0) + dx;
            transform.translateY = (transform.translateY || 0) + dy;
            return { ...o, transform };
          }
          return o;
        });
        return { ...p, objects };
      }
      return p;
    });
    this.store.setState({ pages });
  }
}
