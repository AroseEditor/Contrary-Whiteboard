import React from 'react';
import useDocumentStore from '../../store/documentStore';
import useUIStore from '../../store/uiStore';
import PageThumbnail from './PageThumbnail';

export default function PagePanel() {
  const pages = useDocumentStore(s => s.pages);
  const currentPageId = useDocumentStore(s => s.currentPageId);
  const setCurrentPage = useDocumentStore(s => s.setCurrentPage);
  const addPage = useDocumentStore(s => s.addPage);
  const removePage = useDocumentStore(s => s.removePage);
  const duplicatePage = useDocumentStore(s => s.duplicatePage);
  const showPagePanel = useUIStore(s => s.showPagePanel);
  const setContextMenu = useUIStore(s => s.setContextMenu);

  if (!showPagePanel) return null;

  const handlePageContext = (e, page) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Duplicate Page', action: () => duplicatePage(page.id) },
        { label: 'Delete Page', action: () => removePage(page.id), disabled: pages.length <= 1 },
        { separator: true },
        { label: `Rename: ${page.name}`, disabled: true }
      ]
    });
  };

  return (
    <div className="page-panel">
      <div className="panel-section">
        <div className="panel-title">PAGES</div>
      </div>
      <div className="page-thumbnail-list">
        {pages.map((page, i) => (
          <PageThumbnail
            key={page.id}
            page={page}
            index={i}
            isActive={page.id === currentPageId}
            onClick={() => setCurrentPage(page.id)}
            onContextMenu={(e) => handlePageContext(e, page)}
          />
        ))}
        <button className="page-add-button" onClick={() => addPage()}>
          + Add Page
        </button>
      </div>
    </div>
  );
}
