import { create } from 'zustand';

const useToolStore = create((set) => ({
  activeTool: 'pen',

  // Pen
  penColor: '#1A1A1A',
  penWidth: 3,
  penOpacity: 1.0,

  // Highlighter
  highlighterColor: '#FFEB3B',
  highlighterWidth: 20,

  // Eraser
  eraserSize: 20,
  eraserMode: 'stroke', // 'stroke' | 'pixel'

  // Line
  lineColor: '#1A1A1A',
  lineWidth: 2,
  lineArrowStart: false,
  lineArrowEnd: false,

  // Shape
  shapeType: 'rectangle', // 'rectangle' | 'ellipse' | 'triangle'
  shapeFillColor: 'transparent',
  shapeStrokeColor: '#1A1A1A',
  shapeStrokeWidth: 2,
  shapeFilled: false,

  // Text
  textFont: 'Arial',
  textSize: 16,
  textColor: '#1A1A1A',
  textBold: false,
  textItalic: false,
  textUnderline: false,

  // Actions
  setActiveTool: (tool) => set({ activeTool: tool }),

  setPenColor: (color) => set({ penColor: color }),
  setPenWidth: (width) => set({ penWidth: width }),
  setPenOpacity: (opacity) => set({ penOpacity: opacity }),

  setHighlighterColor: (color) => set({ highlighterColor: color }),
  setHighlighterWidth: (width) => set({ highlighterWidth: width }),

  setEraserSize: (size) => set({ eraserSize: size }),
  setEraserMode: (mode) => set({ eraserMode: mode }),

  setLineColor: (color) => set({ lineColor: color }),
  setLineWidth: (width) => set({ lineWidth: width }),
  setLineArrowStart: (v) => set({ lineArrowStart: v }),
  setLineArrowEnd: (v) => set({ lineArrowEnd: v }),

  setShapeType: (type) => set({ shapeType: type }),
  setShapeFillColor: (color) => set({ shapeFillColor: color }),
  setShapeStrokeColor: (color) => set({ shapeStrokeColor: color }),
  setShapeStrokeWidth: (width) => set({ shapeStrokeWidth: width }),
  setShapeFilled: (filled) => set({ shapeFilled: filled }),

  setTextFont: (font) => set({ textFont: font }),
  setTextSize: (size) => set({ textSize: size }),
  setTextColor: (color) => set({ textColor: color }),
  setTextBold: (bold) => set({ textBold: bold }),
  setTextItalic: (italic) => set({ textItalic: italic }),
  setTextUnderline: (underline) => set({ textUnderline: underline })
}));

export default useToolStore;
