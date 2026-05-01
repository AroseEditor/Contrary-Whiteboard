import React from 'react';
import useDocumentStore from '../../store/documentStore';
import useUIStore from '../../store/uiStore';

export default function BottomBar() {
  const pages = useDocumentStore(s => s.pages);
  const currentPageId = useDocumentStore(s => s.currentPageId);
  const goToNextPage = useDocumentStore(s => s.goToNextPage);
  const goToPrevPage = useDocumentStore(s => s.goToPrevPage);
  const zoom = useUIStore(s => s.zoom);
  const zoomIn = useUIStore(s => s.zoomIn);
  const zoomOut = useUIStore(s => s.zoomOut);
  const zoomFit = useUIStore(s => s.zoomFit);

  const pageIndex = pages.findIndex(p => p.id === currentPageId);
  const pageNum = pageIndex + 1;
  const totalPages = pages.length;

  return (
    <div className="bottom-bar" id="bottom-bar">
      <div className="bottom-bar-group">
        <button className="bottom-bar-button" onClick={goToPrevPage} title="Previous Page">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span className="bottom-bar-text">{pageNum} / {totalPages}</span>
        <button className="bottom-bar-button" onClick={goToNextPage} title="Next Page">
          <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
        </button>
      </div>

      <div className="bottom-bar-spacer" />

      <div className="bottom-bar-group">
        <button className="bottom-bar-button" onClick={zoomOut} title="Zoom Out">
          <svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>
        </button>
        <span className="bottom-bar-text">{Math.round(zoom * 100)}%</span>
        <button className="bottom-bar-button" onClick={zoomIn} title="Zoom In">
          <svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </button>
        <button className="bottom-bar-button" onClick={zoomFit} title="Fit to View">
          <svg viewBox="0 0 24 24"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
        </button>
      </div>
    </div>
  );
}
