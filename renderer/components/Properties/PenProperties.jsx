import React from 'react';
import useToolStore from '../../store/toolStore';
import ColorPicker from '../common/ColorPicker';
import Slider from '../common/Slider';

export default function PenProperties() {
  const penColor = useToolStore(s => s.penColor);
  const penWidth = useToolStore(s => s.penWidth);
  const penOpacity = useToolStore(s => s.penOpacity);
  const setPenColor = useToolStore(s => s.setPenColor);
  const setPenWidth = useToolStore(s => s.setPenWidth);
  const setPenOpacity = useToolStore(s => s.setPenOpacity);

  return (
    <div>
      <ColorPicker label="Color" value={penColor} onChange={setPenColor} />
      <div className="panel-section">
        <Slider label="Width" value={penWidth} min={1} max={50} onChange={setPenWidth} displayValue={`${penWidth}px`} />
        <Slider label="Opacity" value={penOpacity} min={0.1} max={1} step={0.05} onChange={setPenOpacity} displayValue={`${Math.round(penOpacity * 100)}%`} />
      </div>
    </div>
  );
}
