import React from 'react';
import useToolStore from '../../store/toolStore';
import useDocumentStore from '../../store/documentStore';
import useUIStore from '../../store/uiStore';
import ToolButton from './ToolButton';

// SVG icon paths (clean, outlined, monochrome style)
const ICONS = {
  select: '<path d="M4 4l7 16 2.5-6.5L20 11z"/><path d="M14.5 14.5L20 20"/>',
  pen: '<path d="M3 21l1.5-4.5L17.7 3.3a1 1 0 011.4 0l1.6 1.6a1 1 0 010 1.4L7.5 19.5z"/><path d="M15 5l4 4"/>',
  highlighter: '<path d="M6 20l2-2 8-8 4 4-8 8-2 2z"/><path d="M16 10l-4-4"/><path d="M14 6l4 4"/><path d="M2 22h6"/>',
  eraser: '<path d="M19 11l-6-6-9 9 3 3h4l8-6z"/><path d="M10 17h10"/>',
  line: '<path d="M4 20L20 4"/>',
  rectangle: '<rect x="3" y="3" width="18" height="18" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  text: '<path d="M6 4h12"/><path d="M12 4v16"/><path d="M8 20h8"/>',
  laser: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/>',
  undo: '<path d="M3 10h13a4 4 0 010 8H9"/><path d="M3 10l4-4"/><path d="M3 10l4 4"/>',
  redo: '<path d="M21 10H8a4 4 0 000 8h7"/><path d="M21 10l-4-4"/><path d="M21 10l-4 4"/>',
  clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M5 6v14a1 1 0 001 1h12a1 1 0 001-1V6"/><path d="M10 10v6"/><path d="M14 10v6"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/><path d="M11 8v6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6"/>',
  zoomFit: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>'
};

export default function LeftToolbar() {
  const activeTool = useToolStore(s => s.activeTool);
  const setActiveTool = useToolStore(s => s.setActiveTool);
  const undo = useDocumentStore(s => s.undo);
  const redo = useDocumentStore(s => s.redo);
  const clearPage = useDocumentStore(s => s.clearPage);
  const zoomIn = useUIStore(s => s.zoomIn);
  const zoomOut = useUIStore(s => s.zoomOut);
  const zoomFit = useUIStore(s => s.zoomFit);

  const handleClear = async () => {
    if (typeof window !== 'undefined' && window.require) {
      const { ipcRenderer } = window.require('electron');
      const confirmed = await ipcRenderer.invoke('dialog:confirm', {
        title: 'Clear Page',
        message: 'Clear all objects on this page?',
        detail: 'This action can be undone with Ctrl+Z.'
      });
      if (confirmed) clearPage();
    } else {
      if (window.confirm('Clear all objects on this page?')) clearPage();
    }
  };

  return (
    <div className="left-toolbar" id="left-toolbar">
      <ToolButton icon={ICONS.select} label="Select" shortcut="S" active={activeTool === 'select'} onClick={() => setActiveTool('select')} />
      <ToolButton icon={ICONS.pen} label="Pen" shortcut="P" active={activeTool === 'pen'} onClick={() => setActiveTool('pen')} />
      <ToolButton icon={ICONS.highlighter} label="Highlighter" shortcut="H" active={activeTool === 'highlighter'} onClick={() => setActiveTool('highlighter')} />
      <ToolButton icon={ICONS.eraser} label="Eraser" shortcut="E" active={activeTool === 'eraser'} onClick={() => setActiveTool('eraser')} />
      <ToolButton icon={ICONS.line} label="Line" shortcut="L" active={activeTool === 'line'} onClick={() => setActiveTool('line')} />
      <ToolButton icon={ICONS.rectangle} label="Rectangle" shortcut="" active={activeTool === 'rectangle'} onClick={() => setActiveTool('rectangle')} />
      <ToolButton icon={ICONS.ellipse} label="Ellipse" shortcut="" active={activeTool === 'ellipse'} onClick={() => setActiveTool('ellipse')} />
      <ToolButton icon={ICONS.text} label="Text" shortcut="T" active={activeTool === 'text'} onClick={() => setActiveTool('text')} />
      <ToolButton icon={ICONS.laser} label="Laser Pointer" shortcut="" active={activeTool === 'laser'} onClick={() => setActiveTool('laser')} />

      <div className="tool-separator" />

      <ToolButton icon={ICONS.undo} label="Undo" shortcut="Ctrl+Z" onClick={undo} />
      <ToolButton icon={ICONS.redo} label="Redo" shortcut="Ctrl+Y" onClick={redo} />

      <div className="tool-separator" />

      <ToolButton icon={ICONS.clear} label="Clear Page" shortcut="" onClick={handleClear} />

      <div className="tool-separator" />

      <ToolButton icon={ICONS.zoomIn} label="Zoom In" shortcut="Ctrl+=" onClick={zoomIn} />
      <ToolButton icon={ICONS.zoomOut} label="Zoom Out" shortcut="Ctrl+-" onClick={zoomOut} />
      <ToolButton icon={ICONS.zoomFit} label="Zoom to Fit" shortcut="Ctrl+0" onClick={zoomFit} />
    </div>
  );
}
