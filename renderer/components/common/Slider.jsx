import React from 'react';

export default function Slider({ label, value, min, max, step, onChange, displayValue }) {
  return (
    <div className="slider-container">
      <div className="slider-label">
        <span>{label}</span>
        <span>{displayValue ?? value}</span>
      </div>
      <input
        className="slider-input"
        type="range"
        min={min}
        max={max}
        step={step || 1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
