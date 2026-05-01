export class DeleteObjectCommand {
  constructor(store, pageId, objectIds) {
    this.store = store;
    this.pageId = pageId;
    this.objectIds = objectIds;
    this.deletedObjects = [];
  }

  execute() {
    const state = this.store.getState();
    const pages = state.pages.map(p => {
      if (p.id === this.pageId) {
        this.deletedObjects = p.objects.filter(o => this.objectIds.includes(o.id));
        return { ...p, objects: p.objects.filter(o => !this.objectIds.includes(o.id)) };
      }
      return p;
    });
    this.store.setState({ pages, selectedObjectIds: [] });
  }

  undo() {
    const state = this.store.getState();
    const pages = state.pages.map(p => {
      if (p.id === this.pageId) {
        return { ...p, objects: [...p.objects, ...this.deletedObjects] };
      }
      return p;
    });
    this.store.setState({ pages });
  }
}
