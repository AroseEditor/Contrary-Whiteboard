import React, { useRef, useEffect, useCallback, useState } from 'react';
import useDocumentStore from '../../store/documentStore';
import useToolStore from '../../store/toolStore';
import useUIStore from '../../store/uiStore';
import { CoordinateSystem } from './CoordinateSystem';
import { CanvasRenderer } from './CanvasRenderer';
import { InputHandler } from './InputHandler';
import { PenTool } from '../../tools/PenTool';
import { HighlighterTool } from '../../tools/HighlighterTool';
import { EraserTool } from '../../tools/EraserTool';
import { LineTool } from '../../tools/LineTool';
import { ShapeTool } from '../../tools/ShapeTool';
import { TextTool } from '../../tools/TextTool';
import { SelectorTool } from '../../tools/SelectorTool';
import { LaserTool } from '../../tools/LaserTool';

const coordSystem = new CoordinateSystem();
const renderer = new CanvasRenderer();

// Tool instances
const tools = {
  pen: new PenTool(),
  highlighter: new HighlighterTool(),
  eraser: new EraserTool(),
  line: new LineTool(),
  rectangle: new ShapeTool(),
  ellipse: new ShapeTool(),
  triangle: new ShapeTool(),
  shape: new ShapeTool(),
  text: new TextTool(),
  select: new SelectorTool(),
  laser: new LaserTool()
};

export default function PageCanvas() {
  const canvasRef = useRef(null);
  const inputHandlerRef = useRef(null);
  const rafRef = useRef(null);
  const [textOverlay, setTextOverlay] = useState(null);

  // Store subscriptions
  const pages = useDocumentStore(s => s.pages);
  const currentPageId = useDocumentStore(s => s.currentPageId);
  const selectedObjectIds = useDocumentStore(s => s.selectedObjectIds);
  const activeTool = useToolStore(s => s.activeTool);
  const zoom = useUIStore(s => s.zoom);
  const panOffset = useUIStore(s => s.panOffset);
  const showGrid = useUIStore(s => s.showGrid);

  const currentPage = pages.find(p => p.id === currentPageId) || pages[0];

  // Get active tool instance
  const getActiveTool = useCallback(() => {
    const tool = activeTool;
    if (tool === 'rectangle' || tool === 'ellipse' || tool === 'triangle') {
      return tools.shape;
    }
    return tools[tool] || tools.pen;
  }, [activeTool]);

  // Resize canvas to fill container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }, []);

  // Render frame
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentPage) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    coordSystem.update(zoom, panOffset, dpr);

    const tool = getActiveTool();

    renderer.renderPage(ctx, currentPage, coordSystem, {
      showGrid,
      selectedObjectIds,
      selectionRect: tool.selectionRect || null
    });

    // Tool-specific overlays
    if (activeTool === 'laser' && tool.points) {
      renderer.renderLaser(ctx, tool.points, coordSystem);
    }

    if (activeTool === 'eraser' && tool.cursorPos) {
      const eraserSize = useToolStore.getState().eraserSize;
      renderer.renderEraserCursor(ctx, tool.cursorPos, eraserSize, coordSystem);
    }

    // Active drawing preview (pen stroke being drawn, shape being dragged, etc.)
    if (tool.previewObject) {
      coordSystem.applyTransform(ctx);
      renderer.renderObject(ctx, tool.previewObject);
      coordSystem.resetTransform(ctx);
    }
  }, [currentPage, zoom, panOffset, showGrid, selectedObjectIds, activeTool, getActiveTool]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      renderFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [renderFrame]);

  // Setup input handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const inputHandler = new InputHandler(coordSystem, {
      onPointerDown: (pos, e) => {
        const tool = getActiveTool();
        const context = getToolContext();
        tool.onPointerDown(pos, context);

        // Text tool: show text overlay
        if (activeTool === 'text' && tool.showTextInput) {
          const screenPos = coordSystem.canvasToScreen(pos.x, pos.y);
          setTextOverlay({
            x: screenPos.x,
            y: screenPos.y,
            canvasX: pos.x,
            canvasY: pos.y
          });
        }
      },
      onPointerMove: (pos, e) => {
        const tool = getActiveTool();
        const context = getToolContext();
        tool.onPointerMove(pos, context);
      },
      onPointerUp: (pos, e) => {
        const tool = getActiveTool();
        const context = getToolContext();
        tool.onPointerUp(pos, context);
      },
      onZoom: (delta, mouseX, mouseY) => {
        const state = useUIStore.getState();
        const oldZoom = state.zoom;
        const newZoom = Math.max(0.1, Math.min(20, oldZoom * delta));

        // Zoom towards mouse position
        const newPanX = mouseX - (mouseX - state.panOffset.x) * (newZoom / oldZoom);
        const newPanY = mouseY - (mouseY - state.panOffset.y) * (newZoom / oldZoom);

        useUIStore.setState({
          zoom: newZoom,
          panOffset: { x: newPanX, y: newPanY }
        });
      },
      onPan: (dx, dy) => {
        useUIStore.getState().pan(dx, dy);
      },
      onContextMenu: (pos, e) => {
        handleContextMenu(pos, e);
      }
    });

    inputHandler.bind(canvas);
    inputHandlerRef.current = inputHandler;

    return () => {
      inputHandler.unbind();
    };
  }, [activeTool, getActiveTool]);

  // Tool context provider
  const getToolContext = useCallback(() => {
    return {
      store: useDocumentStore,
      toolStore: useToolStore,
      uiStore: useUIStore,
      coordSystem,
      renderer
    };
  }, []);

  // Right-click context menu
  const handleContextMenu = useCallback((pos, e) => {
    const docState = useDocumentStore.getState();
    const items = [];

    if (docState.selectedObjectIds.length > 0) {
      items.push(
        { label: 'Cut', shortcut: 'Ctrl+X', action: () => docState.cutSelection() },
        { label: 'Copy', shortcut: 'Ctrl+C', action: () => docState.copySelection() },
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => docState.pasteClipboard() },
        { separator: true },
        { label: 'Duplicate', shortcut: 'Ctrl+D', action: () => docState.duplicateSelection() },
        { label: 'Delete', shortcut: 'Del', action: () => docState.removeObjects(docState.selectedObjectIds) },
        { separator: true },
        { label: 'Bring to Front', action: () => docState.bringToFront(docState.selectedObjectIds) },
        { label: 'Send to Back', action: () => docState.sendToBack(docState.selectedObjectIds) }
      );
    } else {
      items.push(
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => docState.pasteClipboard(), disabled: docState.clipboard.length === 0 },
        { separator: true },
        { label: 'Select All', shortcut: 'Ctrl+A', action: () => docState.selectAll() },
        { separator: true },
        { label: 'Clear Page', action: () => docState.clearPage() }
      );
    }

    useUIStore.getState().setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items
    });
  }, []);

  // Handle text overlay submit
  const handleTextSubmit = useCallback((text) => {
    if (!text || !textOverlay) {
      setTextOverlay(null);
      return;
    }

    const toolState = useToolStore.getState();
    const textObj = {
      id: require('../../utils/uuid').generateId(),
      type: 'text',
      text,
      fontFamily: toolState.textFont,
      fontSize: toolState.textSize,
      color: toolState.textColor,
      bold: toolState.textBold,
      italic: toolState.textItalic,
      underline: toolState.textUnderline,
      bounds: {
        x: textOverlay.canvasX,
        y: textOverlay.canvasY,
        w: 200,
        h: toolState.textSize * 1.5
      },
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
      locked: false
    };

    useDocumentStore.getState().addObject(textObj);
    setTextOverlay(null);
  }, [textOverlay]);

  // Resize on mount and window resize
  useEffect(() => {
    resizeCanvas();
    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeCanvas]);

  // Drag and drop images
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(f => f.type.startsWith('image/'));
    if (!imageFile) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const rect = canvasRef.current.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const canvasPos = coordSystem.screenToCanvas(screenX, screenY);

        const imgObj = {
          id: require('../../utils/uuid').generateId(),
          type: 'image',
          src: reader.result,
          bounds: {
            x: canvasPos.x - img.naturalWidth / 2,
            y: canvasPos.y - img.naturalHeight / 2,
            w: img.naturalWidth,
            h: img.naturalHeight
          },
          transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
          visible: true,
          locked: false
        };

        useDocumentStore.getState().addObject(imgObj);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(imageFile);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div className="canvas-area" onDrop={handleDrop} onDragOver={handleDragOver}>
      <canvas ref={canvasRef} id="main-canvas" />
      {textOverlay && (
        <div
          className="text-input-overlay"
          style={{ left: textOverlay.x, top: textOverlay.y }}
        >
          <textarea
            autoFocus
            style={{
              width: 200,
              minHeight: 30,
              fontFamily: useToolStore.getState().textFont,
              fontSize: useToolStore.getState().textSize,
              color: useToolStore.getState().textColor,
              fontWeight: useToolStore.getState().textBold ? 'bold' : 'normal',
              fontStyle: useToolStore.getState().textItalic ? 'italic' : 'normal'
            }}
            onBlur={(e) => handleTextSubmit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setTextOverlay(null);
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleTextSubmit(e.target.value);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
