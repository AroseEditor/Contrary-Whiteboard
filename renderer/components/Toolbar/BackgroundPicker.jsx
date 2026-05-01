import React, { useState, useRef, useEffect } from 'react';
import useUIStore from '../../store/uiStore';
import useSettingsStore from '../../store/settingsStore';

const BG_OPTIONS = [
  {
    id: 'white',
    label: 'White Board',
    render: (ctx, w, h) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#E0E0E0';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }
  },
  {
    id: 'black',
    label: 'Blackboard',
    render: (ctx, w, h) => {
      ctx.fillStyle = '#1A1A2E';
      ctx.fillRect(0, 0, w, h);
      // chalk dust texture
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 30; i++) {
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }
  },
  {
    id: 'copy',
    label: 'Notebook',
    render: (ctx, w, h) => {
      ctx.fillStyle = '#FFFEF7';
      ctx.fillRect(0, 0, w, h);

      // Ruled lines
      ctx.strokeStyle = 'rgba(100, 149, 237, 0.35)';
      ctx.lineWidth = 0.8;
      const spacing = 12;
      ctx.beginPath();
      for (let y = 20; y < h; y += spacing) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Margin line
      ctx.strokeStyle = 'rgba(220, 80, 80, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(24, h);
      ctx.stroke();
    }
  }
];

export default function BackgroundPicker() {
  const [isOpen, setIsOpen] = useState(false);
  const boardBackground = useUIStore(s => s.boardBackground);
  const setBoardBackground = useUIStore(s => s.setBoardBackground);
  const canvasRefs = useRef({});

  // Render preview canvases when open
  useEffect(() => {
    if (!isOpen) return;
    // Small delay so canvas refs are populated
    requestAnimationFrame(() => {
      BG_OPTIONS.forEach(opt => {
        const canvas = canvasRefs.current[opt.id];
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        opt.render(ctx, canvas.width, canvas.height);
      });
    });
  }, [isOpen]);

  const handleSelect = (id) => {
    setBoardBackground(id);
    useSettingsStore.getState().updateSetting('boardBackground', id);
    setIsOpen(false);
  };

  const currentOption = BG_OPTIONS.find(o => o.id === boardBackground) || BG_OPTIONS[0];

  return (
    <>
      <button
        className="tool-button"
        onClick={() => setIsOpen(true)}
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
        <span className="tool-tooltip">Background</span>
      </button>

      {isOpen && (
        <div className="bg-modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="bg-modal" onClick={e => e.stopPropagation()}>
            <div className="bg-modal-title">Choose Background</div>
            <div className="bg-modal-options">
              {BG_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  className={`bg-modal-option${boardBackground === opt.id ? ' active' : ''}`}
                  onClick={() => handleSelect(opt.id)}
                >
                  <canvas
                    ref={el => { canvasRefs.current[opt.id] = el; }}
                    width={160}
                    height={110}
                    className="bg-modal-canvas"
                  />
                  <span className="bg-modal-label">{opt.label}</span>
                  {boardBackground === opt.id && (
                    <span className="bg-modal-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
