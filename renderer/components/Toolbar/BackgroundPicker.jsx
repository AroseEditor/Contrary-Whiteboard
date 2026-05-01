import React, { useState, useRef, useEffect } from 'react';
import useUIStore from '../../store/uiStore';
import useSettingsStore from '../../store/settingsStore';

const BG_OPTIONS = [
  {
    id: 'white',
    label: 'White',
    render: (ctx, w, h) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    }
  },
  {
    id: 'black',
    label: 'Blackboard',
    render: (ctx, w, h) => {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'copy',
    label: 'Notebook',
    render: (ctx, w, h) => {
      // Paper color
      ctx.fillStyle = '#FFFEF7';
      ctx.fillRect(0, 0, w, h);

      // Ruled lines
      ctx.strokeStyle = 'rgba(100, 149, 237, 0.4)';
      ctx.lineWidth = 0.5;
      const spacing = 6;
      ctx.beginPath();
      for (let y = 10; y < h; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Margin line
      ctx.strokeStyle = 'rgba(220, 80, 80, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(12, h);
      ctx.stroke();
    }
  }
];

export default function BackgroundPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const boardBackground = useUIStore(s => s.boardBackground);
  const setBoardBackground = useUIStore(s => s.setBoardBackground);
  const popupRef = useRef(null);
  const canvasRefs = useRef({});

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Render preview canvases when open
  useEffect(() => {
    if (!isOpen) return;
    BG_OPTIONS.forEach(opt => {
      const canvas = canvasRefs.current[opt.id];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      opt.render(ctx, w, h);
    });
  }, [isOpen]);

  const handleSelect = (id) => {
    setBoardBackground(id);
    // Persist in settings
    useSettingsStore.getState().updateSetting('boardBackground', id);
    setIsOpen(false);
  };

  // Get current icon preview
  const currentOption = BG_OPTIONS.find(o => o.id === boardBackground) || BG_OPTIONS[0];

  return (
    <div className="bg-picker-wrapper" ref={popupRef}>
      <button
        className="tool-button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Background: ${currentOption.label}`}
      >
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2"
            fill={boardBackground === 'black' ? '#1A1A2E' : boardBackground === 'copy' ? '#FFFEF7' : '#fff'}
            stroke="currentColor" strokeWidth="1.5"
          />
          {boardBackground === 'copy' && (
            <>
              <line x1="3" y1="8" x2="21" y2="8" stroke="rgba(100,149,237,0.5)" strokeWidth="0.5" />
              <line x1="3" y1="12" x2="21" y2="12" stroke="rgba(100,149,237,0.5)" strokeWidth="0.5" />
              <line x1="3" y1="16" x2="21" y2="16" stroke="rgba(100,149,237,0.5)" strokeWidth="0.5" />
              <line x1="7" y1="3" x2="7" y2="21" stroke="rgba(220,80,80,0.5)" strokeWidth="0.8" />
            </>
          )}
        </svg>
        <span className="tool-tooltip">
          Background
        </span>
      </button>

      {isOpen && (
        <div className="bg-picker-popup">
          {BG_OPTIONS.map(opt => (
            <button
              key={opt.id}
              className={`bg-picker-option${boardBackground === opt.id ? ' active' : ''}`}
              onClick={() => handleSelect(opt.id)}
              title={opt.label}
            >
              <canvas
                ref={el => { canvasRefs.current[opt.id] = el; }}
                width={56}
                height={40}
                className="bg-picker-canvas"
              />
              <span className="bg-picker-label">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
