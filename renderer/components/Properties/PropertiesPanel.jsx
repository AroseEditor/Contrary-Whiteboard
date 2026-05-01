import React from 'react';
import useToolStore from '../../store/toolStore';
import useUIStore from '../../store/uiStore';
import PenProperties from './PenProperties';
import ShapeProperties from './ShapeProperties';
import TextProperties from './TextProperties';
import ColorPicker from '../common/ColorPicker';
import Slider from '../common/Slider';

export default function PropertiesPanel() {
  const showPropertiesPanel = useUIStore(s => s.showPropertiesPanel);
  const activeTool = useToolStore(s => s.activeTool);

  if (!showPropertiesPanel) return null;

  const renderToolProperties = () => {
    switch (activeTool) {
      case 'pen':
        return <PenProperties />;

      case 'highlighter':
        return (
          <div>
            <ColorPicker
              label="Color"
              value={useToolStore.getState().highlighterColor}
              onChange={useToolStore.getState().setHighlighterColor}
            />
            <div className="panel-section">
              <Slider
                label="Width"
                value={useToolStore.getState().highlighterWidth}
                min={5}
                max={50}
                onChange={useToolStore.getState().setHighlighterWidth}
                displayValue={`${useToolStore.getState().highlighterWidth}px`}
              />
            </div>
          </div>
        );

      case 'eraser':
        return (
          <div className="panel-section">
            <div className="panel-title">ERASER</div>
            <Slider
              label="Size"
              value={useToolStore.getState().eraserSize}
              min={5}
              max={100}
              onChange={useToolStore.getState().setEraserSize}
              displayValue={`${useToolStore.getState().eraserSize}px`}
            />
          </div>
        );

      case 'line':
        return (
          <div>
            <ColorPicker
              label="Color"
              value={useToolStore.getState().lineColor}
              onChange={useToolStore.getState().setLineColor}
            />
            <div className="panel-section">
              <Slider
                label="Width"
                value={useToolStore.getState().lineWidth}
                min={1}
                max={20}
                onChange={useToolStore.getState().setLineWidth}
                displayValue={`${useToolStore.getState().lineWidth}px`}
              />
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={useToolStore.getState().lineArrowStart}
                  onChange={e => useToolStore.getState().setLineArrowStart(e.target.checked)}
                />
                Arrow Start
              </label>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={useToolStore.getState().lineArrowEnd}
                  onChange={e => useToolStore.getState().setLineArrowEnd(e.target.checked)}
                />
                Arrow End
              </label>
            </div>
          </div>
        );

      case 'rectangle':
      case 'ellipse':
      case 'triangle':
      case 'shape':
        return <ShapeProperties />;

      case 'text':
        return <TextProperties />;

      default:
        return (
          <div className="panel-section">
            <div style={{ color: 'var(--text-muted)', fontSize: 11, textAlign: 'center', padding: '20px 0' }}>
              Select a tool to see its properties
            </div>
          </div>
        );
    }
  };

  return (
    <div className="properties-panel">
      <div className="panel-section">
        <div className="panel-title">PROPERTIES</div>
      </div>
      {renderToolProperties()}
    </div>
  );
}
