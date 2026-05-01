export class AddObjectCommand {
  constructor(store, pageId, object) {
    this.store = store;
    this.pageId = pageId;
    this.object = object;
  }

  execute() {
    const state = this.store.getState();
    const pages = state.pages.map(p => {
      if (p.id === this.pageId) {
        return { ...p, objects: [...p.objects, this.object] };
      }
      return p;
    });
    this.store.setState({ pages });
  }

  undo() {
    const state = this.store.getState();
    const pages = state.pages.map(p => {
      if (p.id === this.pageId) {
        return { ...p, objects: p.objects.filter(o => o.id !== this.object.id) };
      }
      return p;
    });
    this.store.setState({ pages });
  }
}
