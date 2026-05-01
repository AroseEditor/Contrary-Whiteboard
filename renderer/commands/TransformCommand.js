export class TransformCommand {
  constructor(store, pageId, objectId, oldProps, newProps) {
    this.store = store;
    this.pageId = pageId;
    this.objectId = objectId;
    this.oldProps = oldProps; // { bounds, transform }
    this.newProps = newProps;
  }

  execute() {
    this._applyProps(this.newProps);
  }

  undo() {
    this._applyProps(this.oldProps);
  }

  _applyProps(props) {
    const state = this.store.getState();
    const pages = state.pages.map(p => {
      if (p.id === this.pageId) {
        const objects = p.objects.map(o => {
          if (o.id === this.objectId) {
            return { ...o, ...props };
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

// Batch version: transforms multiple objects at once
export class BatchTransformCommand {
  constructor(store, pageId, transforms) {
    // transforms: [{ objectId, oldProps, newProps }]
    this.store = store;
    this.pageId = pageId;
    this.transforms = transforms;
  }

  execute() {
    this._apply('newProps');
  }

  undo() {
    this._apply('oldProps');
  }

  _apply(which) {
    const state = this.store.getState();
    const transformMap = {};
    for (const t of this.transforms) {
      transformMap[t.objectId] = t[which];
    }

    const pages = state.pages.map(p => {
      if (p.id === this.pageId) {
        const objects = p.objects.map(o => {
          if (transformMap[o.id]) {
            return { ...o, ...transformMap[o.id] };
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
