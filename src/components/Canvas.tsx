import { useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Stage, Layer, Group, Rect, Transformer } from 'react-konva';
import type { Template, CanvasElement, TextElement, ShapeElement, ImageElement } from '../types/template';
import type Konva from 'konva';
import { ShapeRenderer } from './canvas/ShapeRenderer';
import { TextRenderer } from './canvas/TextRenderer';
import { ImageRenderer } from './canvas/ImageRenderer';

interface CanvasProps {
  template: Template;
  elements: CanvasElement[];
  scale?: number;
  canvasColor: string;
  fileName?: string;
  onTextChange?: (id: string, newText: string) => void;
  selectedElementIds?: string[];
  onSelectElement?: (ids: string[]) => void;
  onElementUpdate?: (id: string, updates: Partial<CanvasElement>) => void;
  onElementsUpdate?: (ids: string[], updateFn: (element: CanvasElement) => Partial<CanvasElement>) => void;
  onImageDrop?: (file: File, width: number, height: number) => void;
  onImageLoad?: (id: string, status: 'loaded' | 'error') => void;
  entranceAnimationPhase?: 'idle' | 'loading' | 'animating' | 'complete';
  textPlacementMode?: boolean;
  onPlaceText?: (x: number, y: number) => string;
  onEditingChange?: (isEditing: boolean) => void;
  onBackgroundTouchStart?: (clientX: number, clientY: number) => void;
  onTransformingChange?: (isTransforming: boolean) => void;
}

export interface CanvasRef {
  exportImage: () => string;
  exportThumbnail: () => string;
  getNodesMap: () => Map<string, Konva.Node>;
  getLayerNode: () => Konva.Layer | null;
}

// Bleed area around artboard (canvas units) so elements/transformers
// that extend beyond the artboard boundary remain visible.
export const BLEED = 400;

// Custom "T" cursor SVG for text placement mode
const TEXT_PLACEMENT_CURSOR = (() => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M6 3h12M12 3v18' stroke='white' stroke-width='3' stroke-linecap='round' fill='none'/><path d='M6 3h12M12 3v18' stroke='%23333' stroke-width='1.5' stroke-linecap='round' fill='none'/></svg>`;
  return `url("data:image/svg+xml,${svg}") 12 3, text`;
})();

export const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  { template, elements, scale = 0.5, canvasColor, fileName = 'artwork-01.png', onTextChange, selectedElementIds = [], onSelectElement, onElementUpdate, onElementsUpdate, onImageDrop, onImageLoad, entranceAnimationPhase, textPlacementMode, onPlaceText, onEditingChange, onBackgroundTouchStart, onTransformingChange },
  ref
) {
  const { t } = useTranslation('editor');
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRefsMap = useRef<Map<string, Konva.Transformer>>(new Map());
  const multiTransformerRef = useRef<Konva.Transformer>(null);
  const nodesRef = useRef<Map<string, Konva.Node>>(new Map());
  const [isEditing, setIsEditing] = useState(false);
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const lassoJustFinishedRef = useRef(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isMultiDragging, setIsMultiDragging] = useState(false);
  const pendingEditIdRef = useRef<string | null>(null);
  const isPinchingRef = useRef(false);
  const hadPinchGestureRef = useRef(false);
  const pinchBlockUntilRef = useRef(0);
  const multiDragRef = useRef<{
    active: boolean;
    draggedId: string | null;
    startPositions: Map<string, { x: number; y: number }>;
    elementMap: Map<string, CanvasElement>;
  }>({ active: false, draggedId: null, startPositions: new Map(), elementMap: new Map() });
  const multiDragLockAxisRef = useRef<'x' | 'y' | null>(null);

  // Always-current ref for selectedElementIds — prevents stale closure bugs
  // in event handlers (handleElementClick, handleElementDragStart) that may
  // fire before React has re-rendered with the latest props.
  const selectedIdsRef = useRef(selectedElementIds);
  selectedIdsRef.current = selectedElementIds;

  const isElementInteractionBlocked = () => {
    return isPinchingRef.current || Date.now() < pinchBlockUntilRef.current;
  };

  const stopActiveDrags = () => {
    nodesRef.current.forEach((node) => {
      const draggableNode = node as Konva.Node & { isDragging?: () => boolean; stopDrag?: () => void };
      if (typeof draggableNode.isDragging === 'function' && draggableNode.isDragging()) {
        draggableNode.stopDrag?.();
      }
    });

    multiDragRef.current = { active: false, draggedId: null, startPositions: new Map(), elementMap: new Map() };
    setIsMultiDragging(false);
    multiDragLockAxisRef.current = null;
  };

  // Track Shift key state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useImperativeHandle(ref, () => ({
    exportImage: () => {
      if (!stageRef.current) {
        console.error('Export failed: stageRef is null');
        return '';
      }

      const stage = stageRef.current;
      const layers = stage.getLayers();
      if (layers.length === 0) {
        console.error('Export failed: no layers found');
        return '';
      }

      const restoreSelection = () => {
        if (isEditing) return;

        selectedElementIds.forEach(id => {
          const tr = transformerRefsMap.current.get(id);
          const node = nodesRef.current.get(id);
          if (tr && node) tr.nodes([node]);
        });

        if (selectedElementIds.length > 1 && multiTransformerRef.current) {
          const selectedNodes = selectedElementIds
            .map(id => nodesRef.current.get(id))
            .filter((node): node is Konva.Node => !!node);
          multiTransformerRef.current.nodes(selectedNodes);
        }

        layers[0].batchDraw();
      };

      const exportStage = (
        options: {
          mimeType: string;
          quality: number;
          pixelRatio: number;
        },
        errorPrefix: string
      ) => {
        transformerRefsMap.current.forEach(tr => tr.nodes([]));
        if (multiTransformerRef.current) multiTransformerRef.current.nodes([]);

        layers[0].batchDraw();

        try {
          const dataURL = stage.toDataURL({
            x: BLEED * scale,
            y: BLEED * scale,
            width: template.width * scale,
            height: template.height * scale,
            pixelRatio: options.pixelRatio,
            mimeType: options.mimeType,
            quality: options.quality,
          });

          restoreSelection();
          return dataURL;
        } catch (error) {
          restoreSelection();
          console.error(`${errorPrefix}:`, error);
          return '';
        }
      };

      const dataURL = exportStage({
        mimeType: 'image/png',
        quality: 1,
        pixelRatio: 1 / scale,
      }, 'Export failed with error');

      console.log('Export dataURL length:', dataURL?.length || 0);
      return dataURL;
    },
    exportThumbnail: () => {
      if (!stageRef.current) {
        console.error('Thumbnail export failed: stageRef is null');
        return '';
      }

      const stage = stageRef.current;
      const layers = stage.getLayers();
      if (layers.length === 0) {
        console.error('Thumbnail export failed: no layers found');
        return '';
      }

      const restoreSelection = () => {
        if (isEditing) return;

        selectedElementIds.forEach(id => {
          const tr = transformerRefsMap.current.get(id);
          const node = nodesRef.current.get(id);
          if (tr && node) tr.nodes([node]);
        });

        if (selectedElementIds.length > 1 && multiTransformerRef.current) {
          const selectedNodes = selectedElementIds
            .map(id => nodesRef.current.get(id))
            .filter((node): node is Konva.Node => !!node);
          multiTransformerRef.current.nodes(selectedNodes);
        }

        layers[0].batchDraw();
      };

      try {
        const originalWidth = template.width;
        const maxThumbnailWidth = 400;
        const thumbnailScale = maxThumbnailWidth / originalWidth;
        const pixelRatio = thumbnailScale / scale;

        transformerRefsMap.current.forEach(tr => tr.nodes([]));
        if (multiTransformerRef.current) multiTransformerRef.current.nodes([]);
        layers[0].batchDraw();

        const dataURL = stage.toDataURL({
          x: BLEED * scale,
          y: BLEED * scale,
          width: template.width * scale,
          height: template.height * scale,
          pixelRatio,
          mimeType: 'image/jpeg',
          quality: 0.7,
        });

        restoreSelection();
        console.log('Thumbnail dataURL length:', dataURL?.length || 0, 'pixelRatio:', pixelRatio);
        return dataURL;
      } catch (error) {
        restoreSelection();
        console.error('Thumbnail export failed with error:', error);
        return '';
      }
    },
    getNodesMap: () => nodesRef.current,
    getLayerNode: () => stageRef.current?.getLayers()[0] ?? null,
  }), [scale, selectedElementIds, isEditing, template.width, template.height]);

  // Update individual transformers and reset multi-drag when selection changes
  useEffect(() => {
    // Force-reset multi-drag state whenever selection changes.
    // This prevents "ghost grouping" where elements move together
    // after the visual selection (bounding boxes) has been cleared.
    multiDragRef.current = { active: false, draggedId: null, startPositions: new Map(), elementMap: new Map() };
    setIsMultiDragging(false);
    multiDragLockAxisRef.current = null;

    if (selectedElementIds.length > 0 && !isEditing) {
      // Attach each individual transformer to its node
      selectedElementIds.forEach(id => {
        const tr = transformerRefsMap.current.get(id);
        const node = nodesRef.current.get(id);
        if (tr && node) {
          tr.nodes([node]);
        }
      });

      // Attach group transformer for multi-selection
      if (selectedElementIds.length > 1 && multiTransformerRef.current) {
        const selectedNodes = selectedElementIds
          .map(id => nodesRef.current.get(id))
          .filter((node): node is Konva.Node => !!node);
        multiTransformerRef.current.nodes(selectedNodes);
      }
    }

    // Clear transformers for deselected elements
    transformerRefsMap.current.forEach((tr, id) => {
      if (!selectedElementIds.includes(id) || isEditing) {
        tr.nodes([]);
      }
    });

    // Clear group transformer when not multi-selected
    if (selectedElementIds.length <= 1 && multiTransformerRef.current) {
      multiTransformerRef.current.nodes([]);
    }

    stageRef.current?.getLayers()[0]?.batchDraw();
  }, [selectedElementIds, isEditing, elements]);

  // Handle element selection (single or multi with Shift)
  // Uses selectedIdsRef to always read the latest selection,
  // avoiding stale-closure bugs when clicks happen in rapid succession.
  const handleElementClick = (id: string, event: Konva.KonvaEventObject<MouseEvent | Event>) => {
    if (!onSelectElement) return;
    if (isElementInteractionBlocked()) {
      event.cancelBubble = true;
      return;
    }

    const current = selectedIdsRef.current;
    const isShiftPressed = 'shiftKey' in event.evt ? event.evt.shiftKey : false;
    const isAlreadySelected = current.includes(id);

    if (isShiftPressed) {
      // Shift+Click: toggle selection
      if (isAlreadySelected) {
        onSelectElement(current.filter(selectedId => selectedId !== id));
      } else {
        onSelectElement([...current, id]);
      }
    } else {
      // Regular click: select only this element, unless it's already
      // part of a multi-selection (keep multi for multi-drag)
      if (!isAlreadySelected || current.length === 1) {
        onSelectElement([id]);
      }
    }
  };

  const handleElementDragStart = (id: string, _event: Konva.KonvaEventObject<DragEvent>) => {
    if (isElementInteractionBlocked()) {
      stopActiveDrags();
      return;
    }

    const current = selectedIdsRef.current;
    const isAlreadySelected = current.includes(id);

    if (!isAlreadySelected && onSelectElement) {
      onSelectElement([id]);
    }

    if (current.length <= 1 || !isAlreadySelected) {
      multiDragRef.current = { active: false, draggedId: null, startPositions: new Map(), elementMap: new Map() };
      setIsMultiDragging(false);
      multiDragLockAxisRef.current = null;
      return;
    }

    const startPositions = new Map<string, { x: number; y: number }>();
    const elementMap = new Map<string, CanvasElement>();
    current.forEach((selectedId) => {
      const element = elements.find(el => el.id === selectedId);
      if (element) {
        startPositions.set(selectedId, { x: element.x, y: element.y });
        elementMap.set(selectedId, element);
      }
    });

    multiDragRef.current = {
      active: true,
      draggedId: id,
      startPositions,
      elementMap,
    };
    multiDragLockAxisRef.current = null;
    setIsMultiDragging(true);
  };

  const handleElementDragMove = (id: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const { active, draggedId, startPositions, elementMap } = multiDragRef.current;
    if (!active || draggedId !== id) return;

    const draggedElement = elementMap.get(id);
    const draggedStart = startPositions.get(id);
    if (!draggedStart || !draggedElement) return;

    // Calculate delta using logical coordinates
    // For Star/Circle, node.x() is center coordinate, so convert to top-left
    let currentX = event.target.x();
    let currentY = event.target.y();

    if (draggedElement.type === 'shape') {
      const shapeEl = draggedElement as ShapeElement;
      if (shapeEl.shapeType === 'star' || shapeEl.shapeType === 'circle') {
        // Convert center coordinate to top-left coordinate
        currentX = currentX - shapeEl.width / 2;
        currentY = currentY - shapeEl.height / 2;
      }
    }

    const dx = currentX - draggedStart.x;
    const dy = currentY - draggedStart.y;
    let constrainedDx = dx;
    let constrainedDy = dy;

    if (isShiftPressed) {
      if (!multiDragLockAxisRef.current) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        if (absDx !== absDy) {
          multiDragLockAxisRef.current = absDx >= absDy ? 'y' : 'x';
        }
      }

      if (multiDragLockAxisRef.current === 'x') {
        constrainedDx = 0;
      } else if (multiDragLockAxisRef.current === 'y') {
        constrainedDy = 0;
      }
    } else {
      multiDragLockAxisRef.current = null;
    }

    const constrainedX = draggedStart.x + constrainedDx;
    const constrainedY = draggedStart.y + constrainedDy;

    // Ensure dragged node follows the constrained path
    let draggedNodeX = constrainedX;
    let draggedNodeY = constrainedY;
    if (draggedElement.type === 'shape') {
      const shapeEl = draggedElement as ShapeElement;
      if (shapeEl.shapeType === 'star' || shapeEl.shapeType === 'circle') {
        draggedNodeX = constrainedX + shapeEl.width / 2;
        draggedNodeY = constrainedY + shapeEl.height / 2;
      }
    }
    event.target.position({ x: draggedNodeX, y: draggedNodeY });

    // Move other selected elements (visual update)
    startPositions.forEach((startPos, elementId) => {
      if (elementId === id) return;
      const node = nodesRef.current.get(elementId);
      const element = elementMap.get(elementId);
      if (!node || !element) return;

      // Set node position based on element type
      let nodeX = startPos.x + constrainedDx;
      let nodeY = startPos.y + constrainedDy;

      if (element.type === 'shape') {
        const shapeEl = element as ShapeElement;
        if (shapeEl.shapeType === 'star' || shapeEl.shapeType === 'circle') {
          // Convert top-left coordinate to center coordinate for rendering
          nodeX = nodeX + shapeEl.width / 2;
          nodeY = nodeY + shapeEl.height / 2;
        }
      }

      node.position({ x: nodeX, y: nodeY });
    });

    event.target.getStage()?.batchDraw();
  };

  const handleElementDragEnd = (id: string, event: Konva.KonvaEventObject<DragEvent>) => {
    const { active, draggedId, startPositions, elementMap } = multiDragRef.current;
    // Multi-drag is active but this is NOT the lead element.
    // Return true to suppress individual drag handler —
    // the lead element's handler will batch-update all elements.
    if (active && draggedId !== id) return true;

    // Not a multi-drag — let individual handler process
    if (!active) return false;

    const draggedElement = elementMap.get(id);
    const draggedStart = startPositions.get(id);
    if (!draggedStart || !draggedElement) return false;

    // Calculate delta using logical coordinates
    // For Star/Circle, node.x() is center coordinate, so convert to top-left
    let currentX = event.target.x();
    let currentY = event.target.y();

    if (draggedElement.type === 'shape') {
      const shapeEl = draggedElement as ShapeElement;
      if (shapeEl.shapeType === 'star' || shapeEl.shapeType === 'circle') {
        // Convert center coordinate to top-left coordinate
        currentX = currentX - shapeEl.width / 2;
        currentY = currentY - shapeEl.height / 2;
      }
    }

    let dx = currentX - draggedStart.x;
    let dy = currentY - draggedStart.y;

    if (multiDragLockAxisRef.current === 'x') {
      dx = 0;
    } else if (multiDragLockAxisRef.current === 'y') {
      dy = 0;
    }

    if (onElementsUpdate) {
      const ids = selectedIdsRef.current.length > 0 ? selectedIdsRef.current : Array.from(startPositions.keys());
      onElementsUpdate(ids, (element) => ({
        x: element.x + dx,
        y: element.y + dy,
      }));
    } else if (onElementUpdate) {
      startPositions.forEach((startPos, elementId) => {
        onElementUpdate(elementId, {
          x: startPos.x + dx,
          y: startPos.y + dy,
        });
      });
    }

    multiDragRef.current = { active: false, draggedId: null, startPositions: new Map(), elementMap: new Map() };
    setIsMultiDragging(false);
    multiDragLockAxisRef.current = null;
    return true;
  };

  // Handle group transform end for multi-selection resize/rotate
  const handleMultiTransformEnd = () => {
    if (!onElementsUpdate) return;

    const currentIds = selectedIdsRef.current;

    // Phase 1: Collect ALL node transform data BEFORE resetting any scales
    // This prevents cascade effects where resetting one node's scale
    // could affect another node's Transformer computation.
    const nodeData = new Map<string, {
      scaleX: number;
      scaleY: number;
      x: number;
      y: number;
      rotation: number;
      width: number;
      height: number;
    }>();

    currentIds.forEach(id => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      nodeData.set(id, {
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        width: node.width(),
        height: node.height(),
      });
    });

    // Phase 2: Reset ALL node scales at once
    currentIds.forEach(id => {
      const node = nodesRef.current.get(id);
      if (!node) return;
      node.scaleX(1);
      node.scaleY(1);
    });

    // Phase 3: Compute updates using collected data
    const updatesMap = new Map<string, Partial<CanvasElement>>();

    currentIds.forEach(id => {
      const data = nodeData.get(id);
      const element = elements.find(el => el.id === id);
      if (!data || !element) return;

      const { scaleX, scaleY, x, y, rotation } = data;

      if (element.type === 'text') {
        const textEl = element as TextElement;
        updatesMap.set(id, {
          x,
          y,
          fontSize: Math.max(10, textEl.fontSize * scaleY),
          rotation,
        });
      } else if (element.type === 'shape') {
        const shape = element as ShapeElement;
        const isCentered = shape.shapeType === 'star' || shape.shapeType === 'circle';
        const newWidth = Math.max(5, shape.width * scaleX);
        const newHeight = Math.max(5, shape.height * scaleY);

        if (isCentered) {
          updatesMap.set(id, {
            x: x - newWidth / 2,
            y: y - newHeight / 2,
            width: newWidth,
            height: newHeight,
            rotation,
          });
        } else {
          updatesMap.set(id, {
            x,
            y,
            width: newWidth,
            height: newHeight,
            rotation,
          });
        }
      } else if (element.type === 'image') {
        const imageEl = element as ImageElement;
        updatesMap.set(id, {
          x,
          y,
          width: Math.max(5, imageEl.width * scaleX),
          height: Math.max(5, imageEl.height * scaleY),
          rotation,
        });
      }

    });

    onElementsUpdate(currentIds, (element) => updatesMap.get(element.id) || {});
  };

  const handleTextDoubleClick = (element: TextElement, textNode: Konva.Text) => {
    if (!stageRef.current || !onTextChange) return;

    setIsEditing(true);
    onEditingChange?.(true);
    const stage = stageRef.current;
    const container = stage.container();

    // Hide the text node temporarily
    textNode.hide();

    // Create textarea element
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    // Get the bounding box of the text node on the canvas
    const textPosition = textNode.getClientRect();
    const stageContainer = container.getBoundingClientRect();

    // Calculate absolute position on the page
    const absoluteX = stageContainer.left + textPosition.x + window.scrollX;
    const absoluteY = stageContainer.top + textPosition.y + window.scrollY;

    // Use actual rendered size from Konva
    const textWidth = Math.max(textPosition.width, 100);
    const textHeight = Math.max(textPosition.height, element.fontSize * scale);

    // Position the textarea
    textarea.value = element.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${absoluteY}px`;
    textarea.style.left = `${absoluteX}px`;
    textarea.style.width = `${textWidth}px`;
    textarea.style.height = `${textHeight}px`;
    textarea.style.fontSize = `${element.fontSize * scale}px`;
    textarea.style.fontFamily = element.fontFamily;
    textarea.style.fontWeight = element.fontWeight.toString();
    textarea.style.letterSpacing = `${(element.letterSpacing ?? 0) * scale}px`;
    textarea.style.textAlign = element.align ?? 'left';
    textarea.style.border = '2px solid #4F46E5';
    textarea.style.padding = '2px 4px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = '1';
    textarea.style.color = element.fill;
    textarea.style.transformOrigin = 'left top';
    textarea.style.zIndex = '1000';
    textarea.style.boxSizing = 'border-box';
    textarea.style.whiteSpace = 'pre';
    textarea.style.wordWrap = 'normal';
    textarea.style.maxHeight = `${template.height * scale}px`;

    // Auto-resize function (only on input, not on init)
    const autoResize = () => {
      const newHeight = Math.max(textarea.scrollHeight, textHeight);
      textarea.style.height = `${newHeight}px`;
    };

    textarea.addEventListener('input', autoResize);

    // Focus and select all text
    textarea.focus();
    textarea.select();

    const removeTextarea = () => {
      textarea.parentNode?.removeChild(textarea);
      textNode.show();
      setIsEditing(false);
      onEditingChange?.(false);
    };

    const handleSubmit = () => {
      const newText = textarea.value;
      onTextChange(element.id, newText);
      removeTextarea();
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        removeTextarea();
      }
    });

    textarea.addEventListener('blur', handleSubmit);
  };

  // Auto-trigger inline editing after text placement
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pendingEditIdRef.current) return;
    const id = pendingEditIdRef.current;
    const node = nodesRef.current.get(id);
    if (node) {
      const textEl = elements.find(el => el.id === id) as TextElement | undefined;
      if (textEl) {
        pendingEditIdRef.current = null;
        setTimeout(() => {
          handleTextDoubleClick(textEl, node as Konva.Text);
        }, 50);
      }
    }
  }, [elements]);

  // Handle file drop on canvas
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (!onImageDrop || !stageRef.current) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) return;

    // Process each image file
    imageFiles.forEach((imageFile) => {
      const objectUrl = URL.createObjectURL(imageFile);
      const img = new Image();
      img.onload = () => {
        onImageDrop(imageFile, img.width, img.height);
        URL.revokeObjectURL(objectUrl);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
      };
      img.src = objectUrl;
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the canvas container itself
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  return (
    <div className="relative" style={textPlacementMode ? { cursor: TEXT_PLACEMENT_CURSOR } : undefined} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      <div className="absolute -top-8 left-0 text-sm font-medium text-gray-700">
        {fileName}
      </div>
      {isDraggingOver && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-4 border-blue-500 border-dashed z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-white px-6 py-3 rounded-lg shadow-lg">
            <p className="text-blue-600 font-semibold text-lg">{t('dropImage')}</p>
          </div>
        </div>
      )}
      <div>
        <Stage
          ref={stageRef}
          width={(template.width + BLEED * 2) * scale}
          height={(template.height + BLEED * 2) * scale}
          scaleX={scale}
          scaleY={scale}
          x={BLEED * scale}
          y={BLEED * scale}
          listening={entranceAnimationPhase !== 'loading' && entranceAnimationPhase !== 'animating'}
          onClick={(e) => {
            // Skip click that fires immediately after lasso selection
            if (lassoJustFinishedRef.current) {
              lassoJustFinishedRef.current = false;
              return;
            }

            const isBackground = e.target === e.target.getStage() ||
                                 (e.target.getClassName() === 'Rect' && e.target.attrs.fill === canvasColor);

            // Text placement mode: place text at click position
            if (textPlacementMode && onPlaceText && isBackground) {
              const stage = e.target.getStage();
              if (!stage) return;
              const pointer = stage.getPointerPosition();
              if (!pointer) return;
              // Convert stage coordinates to canvas coordinates (remove BLEED offset)
              const x = pointer.x / scale - BLEED;
              const y = pointer.y / scale - BLEED;
              // Only allow placement within the canvas bounds
              if (x < 0 || y < 0 || x > template.width || y > template.height) return;
              const newId = onPlaceText(x, y);
              if (newId) pendingEditIdRef.current = newId;
              return;
            }

            // Deselect when clicking on empty area
            if (isBackground && onSelectElement) {
              onSelectElement([]);
            }
          }}
          onMouseDown={(e) => {
            // Start lasso selection on background (not on elements)
            // Elements have draggable=true, so their onMouseDown will stop propagation
            // This only fires when clicking on Stage or background Rect
            const target = e.target;
            const isStage = target === e.target.getStage();
            const isBackgroundRect = target.getClassName() === 'Rect' && target.listening() === false;

            console.log('Stage onMouseDown:', {
              targetClass: target.getClassName(),
              isStage,
              isBackgroundRect,
              listening: target.listening ? target.listening() : 'N/A',
              isEditing
            });

            if ((isStage || isBackgroundRect) && !isEditing && !textPlacementMode) {
              // Get mouse position in canvas coordinates (accounting for scale)
              const stage = e.target.getStage();
              if (!stage) return;

              const pointerPosition = stage.getPointerPosition();
              if (!pointerPosition) return;
              const x = pointerPosition.x;
              const y = pointerPosition.y;

              console.log('Starting lasso selection - stage pos:', { x, y });
              selectionStartRef.current = { x, y };
              setSelectionRect({ x, y, width: 0, height: 0 });
            }
          }}
          onMouseMove={(e) => {
            if (!selectionStartRef.current) {
              // Not in selection mode
              return;
            }

            const stage = e.target.getStage();
            if (!stage) return;

            const pointerPosition = stage.getPointerPosition();
            if (!pointerPosition) return;
            const x = pointerPosition.x;
            const y = pointerPosition.y;

            const startX = selectionStartRef.current.x;
            const startY = selectionStartRef.current.y;

            const rect = {
              x: Math.min(startX, x),
              y: Math.min(startY, y),
              width: Math.abs(x - startX),
              height: Math.abs(y - startY),
            };

            // Only log occasionally to avoid spam
            if (Math.random() < 0.1) {
              console.log('onMouseMove - start:', selectionStartRef.current, 'current:', { x, y }, 'rect:', rect);
            }
            setSelectionRect(rect);
          }}
          onMouseUp={() => {
            if (!selectionRect || !onSelectElement) {
              selectionStartRef.current = null;
              setSelectionRect(null);
              return;
            }

            // Skip if selection area is too small (just a click)
            if (selectionRect.width < 5 && selectionRect.height < 5) {
              selectionStartRef.current = null;
              setSelectionRect(null);
              return;
            }

            // Find all elements that intersect with selection rectangle
            const selected: string[] = [];
            console.log('Lasso selection:', selectionRect);

            elements.forEach((element) => {
              // Skip locked or hidden elements (consistent with click selection)
              if (element.locked || !(element.visible ?? true)) return;

              const node = nodesRef.current.get(element.id);
              if (!node) return;

              // Get bounding box in stage coordinates
              const nodeBox = node.getClientRect({ skipTransform: false });
              console.log('Element:', element.id, 'nodeBox (stage):', nodeBox);

              // Check intersection
              const intersects =
                !(
                  selectionRect.x > nodeBox.x + nodeBox.width ||
                  selectionRect.x + selectionRect.width < nodeBox.x ||
                  selectionRect.y > nodeBox.y + nodeBox.height ||
                  selectionRect.y + selectionRect.height < nodeBox.y
                );

              console.log('Intersects:', intersects);
              if (intersects) {
                selected.push(element.id);
              }
            });

            console.log('Selected elements:', selected);
            if (selected.length > 0) {
              onSelectElement(selected);
              lassoJustFinishedRef.current = true;
            }

            selectionStartRef.current = null;
            setSelectionRect(null);
          }}
          onTouchStart={(e) => {
            // Enable pan from Stage background on touch devices
            // Cancel Konva event processing during pinch to prevent element selection
            if (e.evt.touches && e.evt.touches.length >= 2) {
              isPinchingRef.current = true;
              hadPinchGestureRef.current = true;
              pinchBlockUntilRef.current = Date.now() + 180;
              stopActiveDrags();
              e.cancelBubble = true;
              return;
            }
            const target = e.target;
            const isBackground = target === e.target.getStage() ||
              (target.getClassName() === 'Rect' && target.attrs.fill === canvasColor);

            if (isBackground && !textPlacementMode && !isEditing && onBackgroundTouchStart) {
              const touch = e.evt.touches?.[0];
              if (touch) {
                onBackgroundTouchStart(touch.clientX, touch.clientY);
              }
            }
          }}
          onTouchMove={(e) => {
            // Cancel Konva element drag during pinch gesture
            if (e.evt.touches && e.evt.touches.length >= 2) {
              isPinchingRef.current = true;
              hadPinchGestureRef.current = true;
              pinchBlockUntilRef.current = Date.now() + 180;
              stopActiveDrags();
              e.cancelBubble = true;
            }
          }}
          onTouchEnd={(e) => {
            if (!e.evt.touches || e.evt.touches.length < 2) {
              isPinchingRef.current = false;
              if (hadPinchGestureRef.current) {
                pinchBlockUntilRef.current = Date.now() + 180;
              }
              if (!e.evt.touches || e.evt.touches.length === 0) {
                hadPinchGestureRef.current = false;
              }
            }
          }}
          onTouchCancel={() => {
            isPinchingRef.current = false;
            if (hadPinchGestureRef.current) {
              pinchBlockUntilRef.current = Date.now() + 180;
            }
            hadPinchGestureRef.current = false;
          }}
        >
          <Layer>
            {/* Stage background (BLEED area) - slightly lighter than outer background */}
            <Rect
              x={-BLEED}
              y={-BLEED}
              width={template.width + BLEED * 2}
              height={template.height + BLEED * 2}
              fill="#1a1a1a"
              listening={false}
            />
            {/* Artboard background */}
            <Rect
              x={0}
              y={0}
              width={template.width}
              height={template.height}
              fill={canvasColor}
              listening={false}
            />
            {/* Clip elements to artboard — transformers stay outside */}
            <Group
              clipX={0}
              clipY={0}
              clipWidth={template.width}
              clipHeight={template.height}
              listening={!textPlacementMode}
            >
              {elements.map((element) => {
                const nodeRefSetter = (node: Konva.Node | null, id: string) => {
                  if (node) {
                    nodesRef.current.set(id, node);
                  } else {
                    nodesRef.current.delete(id);
                  }
                };
                const isMultiSelected = selectedElementIds.length > 1 && selectedElementIds.includes(element.id);

                if (element.type === 'shape') {
                  return (
                    <ShapeRenderer
                      key={element.id}
                      shape={element as ShapeElement}
                      isShiftPressed={isShiftPressed}
                      isMultiDragging={isMultiDragging}
                      isMultiSelected={isMultiSelected}
                      onSelect={handleElementClick}
                      onUpdate={onElementUpdate}
                      onDragStart={handleElementDragStart}
                      onDragMove={handleElementDragMove}
                      onDragEnd={handleElementDragEnd}
                      nodeRef={nodeRefSetter}
                    />
                  );
                } else if (element.type === 'text') {
                  return (
                    <TextRenderer
                      key={element.id}
                      textElement={element as TextElement}
                      isShiftPressed={isShiftPressed}
                      isMultiDragging={isMultiDragging}
                      isMultiSelected={isMultiSelected}
                      onSelect={handleElementClick}
                      onDoubleClick={handleTextDoubleClick}
                      onUpdate={onElementUpdate}
                      onDragStart={handleElementDragStart}
                      onDragMove={handleElementDragMove}
                      onDragEnd={handleElementDragEnd}
                      nodeRef={nodeRefSetter}
                    />
                  );
                } else if (element.type === 'image') {
                  return (
                    <ImageRenderer
                      key={element.id}
                      imageElement={element as ImageElement}
                      isShiftPressed={isShiftPressed}
                      isMultiDragging={isMultiDragging}
                      isMultiSelected={isMultiSelected}
                      onSelect={handleElementClick}
                      onUpdate={onElementUpdate}
                      onDragStart={handleElementDragStart}
                      onDragMove={handleElementDragMove}
                      onDragEnd={handleElementDragEnd}
                      nodeRef={nodeRefSetter}
                      onImageLoad={onImageLoad}
                    />
                  );
                }
                return null;
              })}
            </Group>
              {!isEditing && selectedElementIds.map(id => {
                const element = elements.find(el => el.id === id);
                if (!element) return null;
                const isText = element.type === 'text';
                const isMulti = selectedElementIds.length > 1;
                return (
                  <Transformer
                    key={`transformer-${id}`}
                    ref={(trRef) => {
                      if (trRef) transformerRefsMap.current.set(id, trRef);
                      else transformerRefsMap.current.delete(id);
                    }}
                    borderStroke="#4F46E5"
                    borderStrokeWidth={2}
                    borderDash={[4, 4]}
                    anchorStroke="#4F46E5"
                    anchorFill="#FFFFFF"
                    anchorSize={8}
                    enabledAnchors={
                      isMulti
                        ? []
                        : isText
                          ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                          : ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
                    }
                    rotateEnabled={!isMulti}
                    rotationSnaps={isShiftPressed ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
                    rotationSnapTolerance={5}
                    keepRatio={isText}
                    onTransformStart={() => onTransformingChange?.(true)}
                    onTransformEnd={() => onTransformingChange?.(false)}
                  />
                );
              })}
              {/* Group transformer for multi-selection resize/rotate */}
              {!isEditing && selectedElementIds.length > 1 && (
                <Transformer
                  ref={multiTransformerRef}
                  borderStroke="#4F46E5"
                  borderStrokeWidth={1}
                  borderDash={[6, 3]}
                  anchorStroke="#4F46E5"
                  anchorFill="#FFFFFF"
                  anchorSize={10}
                  enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                  rotateEnabled={true}
                  rotationSnaps={isShiftPressed ? [0, 45, 90, 135, 180, 225, 270, 315] : []}
                  rotationSnapTolerance={5}
                  keepRatio={true}
                  onTransformStart={() => onTransformingChange?.(true)}
                  onTransformEnd={() => { onTransformingChange?.(false); handleMultiTransformEnd(); }}
                />
              )}
              {selectionRect && (
                <Rect
                  x={selectionRect.x / scale - BLEED}
                  y={selectionRect.y / scale - BLEED}
                  width={selectionRect.width / scale}
                  height={selectionRect.height / scale}
                  fill="rgba(79, 70, 229, 0.1)"
                  stroke="#4F46E5"
                  strokeWidth={1}
                  dash={[4, 4]}
                  listening={false}
                />
              )}
            </Layer>
          </Stage>
      </div>
    </div>
  );
});
