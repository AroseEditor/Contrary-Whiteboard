import React, { useEffect, useRef } from 'react';
import useUIStore from '../../store/uiStore';

export default function ContextMenu() {
  const contextMenu = useUIStore(s => s.contextMenu);
  const hideContextMenu = useUIStore(s => s.hideContextMenu);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        hideContextMenu();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu, hideContextMenu]);

  if (!contextMenu) return null;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {contextMenu.items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="context-menu-separator" />;
        }
        return (
          <div
            key={i}
            className={`context-menu-item${item.disabled ? ' disabled' : ''}`}
            onClick={() => {
              if (!item.disabled && item.action) {
                item.action();
                hideContextMenu();
              }
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
          </div>
        );
      })}
    </div>
  );
}
