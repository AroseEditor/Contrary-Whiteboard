import React from 'react';
import useToolStore from '../../store/toolStore';
import ColorPicker from '../common/ColorPicker';
import Slider from '../common/Slider';

export default function ShapeProperties() {
  const shapeFillColor = useToolStore(s => s.shapeFillColor);
  const shapeStrokeColor = useToolStore(s => s.shapeStrokeColor);
  const shapeStrokeWidth = useToolStore(s => s.shapeStrokeWidth);
  const shapeFilled = useToolStore(s => s.shapeFilled);
  const setShapeFillColor = useToolStore(s => s.setShapeFillColor);
  const setShapeStrokeColor = useToolStore(s => s.setShapeStrokeColor);
  const setShapeStrokeWidth = useToolStore(s => s.setShapeStrokeWidth);
  const setShapeFilled = useToolStore(s => s.setShapeFilled);

  return (
    <div>
      <div className="panel-section">
        <label className="toggle-row">
          <input type="checkbox" checked={shapeFilled} onChange={e => setShapeFilled(e.target.checked)} />
          Filled
        </label>
      </div>
      {shapeFilled && (
        <ColorPicker label="Fill Color" value={shapeFillColor} onChange={setShapeFillColor} />
      )}
      <ColorPicker label="Stroke Color" value={shapeStrokeColor} onChange={setShapeStrokeColor} />
      <div className="panel-section">
        <Slider label="Stroke Width" value={shapeStrokeWidth} min={1} max={20} onChange={setShapeStrokeWidth} displayValue={`${shapeStrokeWidth}px`} />
      </div>
    </div>
  );
}
