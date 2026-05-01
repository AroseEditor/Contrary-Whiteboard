import React from 'react';

export default function ToolButton({ icon, label, shortcut, active, onClick }) {
  return (
    <button
      className={`tool-button${active ? ' active' : ''}`}
      onClick={onClick}
      title={`${label}${shortcut ? ` (${shortcut})` : ''}`}
    >
      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: icon }} />
      <span className="tool-tooltip">
        {label}
        {shortcut && <span className="shortcut-hint">{shortcut}</span>}
      </span>
    </button>
  );
}
