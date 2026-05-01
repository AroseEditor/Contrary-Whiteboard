import React from 'react';
import useToolStore from '../../store/toolStore';
import ColorPicker from '../common/ColorPicker';

const FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'DM Mono', 'Bebas Neue'];
const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

export default function TextProperties() {
  const textFont = useToolStore(s => s.textFont);
  const textSize = useToolStore(s => s.textSize);
  const textColor = useToolStore(s => s.textColor);
  const textBold = useToolStore(s => s.textBold);
  const textItalic = useToolStore(s => s.textItalic);
  const textUnderline = useToolStore(s => s.textUnderline);
  const setTextFont = useToolStore(s => s.setTextFont);
  const setTextSize = useToolStore(s => s.setTextSize);
  const setTextColor = useToolStore(s => s.setTextColor);
  const setTextBold = useToolStore(s => s.setTextBold);
  const setTextItalic = useToolStore(s => s.setTextItalic);
  const setTextUnderline = useToolStore(s => s.setTextUnderline);

  return (
    <div>
      <div className="panel-section">
        <div className="panel-title">FONT</div>
        <div className="form-group">
          <label>Family</label>
          <select value={textFont} onChange={e => setTextFont(e.target.value)}>
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Size</label>
          <select value={textSize} onChange={e => setTextSize(parseInt(e.target.value))}>
            {SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`btn${textBold ? ' btn-primary' : ''}`}
            onClick={() => setTextBold(!textBold)}
            style={{ fontWeight: 'bold', minWidth: 32 }}
          >B</button>
          <button
            className={`btn${textItalic ? ' btn-primary' : ''}`}
            onClick={() => setTextItalic(!textItalic)}
            style={{ fontStyle: 'italic', minWidth: 32 }}
          >I</button>
          <button
            className={`btn${textUnderline ? ' btn-primary' : ''}`}
            onClick={() => setTextUnderline(!textUnderline)}
            style={{ textDecoration: 'underline', minWidth: 32 }}
          >U</button>
        </div>
      </div>
      <ColorPicker label="Color" value={textColor} onChange={setTextColor} />
    </div>
  );
}
