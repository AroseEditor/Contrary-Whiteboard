import React from 'react';

const PRESET_COLORS = [
  '#1A1A1A', '#FFFFFF', '#E63946', '#F4A261',
  '#E9C46A', '#2A9D8F', '#264653', '#457B9D',
  '#8338EC', '#FF006E', '#3A86FF', '#06D6A0'
];

export default function ColorPicker({ value, onChange, label }) {
  return (
    <div className="panel-section">
      {label && <div className="panel-title">{label}</div>}
      <div className="color-picker-grid">
        {PRESET_COLORS.map(color => (
          <div
            key={color}
            className={`color-swatch${value === color ? ' selected' : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <div className="color-input-row">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} />
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
