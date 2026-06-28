import { useRef, memo } from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import type { TextElement } from '../../types/template';

interface TextRendererProps {
  textElement: TextElement;
  isShiftPressed: boolean;
  isMultiDragging: boolean;
  isMultiSelected: boolean;
  onSelect: (id: string, event: Konva.KonvaEventObject<MouseEvent | Event>) => void;
  onDoubleClick: (element: TextElement, textNode: Konva.Text) => void;
  onUpdate?: (id: string, updates: Partial<TextElement>) => void;
  onDragStart?: (id: string, event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (id: string, event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (id: string, event: Konva.KonvaEventObject<DragEvent>) => boolean;
  nodeRef: (node: Konva.Text | null, id: string) => void;
}

const TextRendererComponent = ({
  textElement,
  isShiftPressed,
  isMultiDragging,
  isMultiSelected,
  onSelect,
  onDoubleClick,
  onUpdate,
  onDragStart,
  onDragMove,
  onDragEnd,
  nodeRef,
}: TextRendererProps) => {
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lockAxisRef = useRef<'x' | 'y' | null>(null);
  const localNodeRef = useRef<Konva.Text | null>(null);

  const resolveLockAxis = (currentPos: { x: number; y: number }, startPos: { x: number; y: number }) => {
    const dx = Math.abs(currentPos.x - startPos.x);
    const dy = Math.abs(currentPos.y - startPos.y);
    if (dx === dy) return null;
    // dx >= dy means horizontal movement, so lock Y (fixed Y-axis)
    return dx >= dy ? 'y' : 'x';
  };

  const resetDragState = () => {
    dragStartPosRef.current = null;
    lockAxisRef.current = null;
  };

  return (
    <Text
      key={textElement.id}
      ref={(node) => {
        localNodeRef.current = node;
        nodeRef(node, textElement.id);
      }}
      text={textElement.text}
      x={textElement.x}
      y={textElement.y}
      fontSize={textElement.fontSize}
      fontFamily={textElement.fontFamily}
      letterSpacing={textElement.letterSpacing ?? 0}
      lineHeight={textElement.lineHeight ?? 1}
      align={textElement.align ?? 'left'}
      fontStyle={textElement.fontWeight >= 700 ? 'bold' : textElement.fontWeight <= 300 ? 'lighter' : 'normal'}
      fill={textElement.fillEnabled ? textElement.fill : 'transparent'}
      stroke={textElement.strokeEnabled ? textElement.stroke : undefined}
      strokeWidth={textElement.strokeEnabled ? textElement.strokeWidth : 0}
      shadowEnabled={textElement.shadowEnabled ?? false}
      shadowColor={textElement.shadowColor ?? '#000000'}
      shadowBlur={textElement.shadowBlur ?? 4}
      shadowOffsetX={textElement.shadowOffsetX ?? 2}
      shadowOffsetY={textElement.shadowOffsetY ?? 2}
      shadowOpacity={textElement.shadowOpacity ?? 0.5}
      rotation={textElement.rotation || 0}
      opacity={textElement.opacity ?? 1}
      visible={textElement.visible ?? true}
      draggable={!textElement.locked && (textElement.visible ?? true)}
      listening={!textElement.locked && (textElement.visible ?? true)}
      onMouseDown={(e) => onSelect(textElement.id, e)}
      onTouchStart={(e) => onSelect(textElement.id, e)}
      onTap={(e) => onSelect(textElement.id, e)}
      onDblClick={(e) => {
        const textNode = e.target as Konva.Text;
        onDoubleClick(textElement, textNode);
      }}
      onDblTap={(e) => {
        const textNode = e.target as Konva.Text;
        onDoubleClick(textElement, textNode);
      }}
      onDragStart={(e) => {
        dragStartPosRef.current = e.target.getAbsolutePosition();
        lockAxisRef.current = null;
        onDragStart?.(textElement.id, e);
      }}
      dragBoundFunc={(pos) => {
        if (isMultiDragging || !dragStartPosRef.current) {
          return pos;
        }

        if (!isShiftPressed) {
          lockAxisRef.current = null;
          return pos;
        }

        const startPos = dragStartPosRef.current;

        if (!lockAxisRef.current) {
          lockAxisRef.current = resolveLockAxis(pos, startPos);
        }

        if (!lockAxisRef.current) {
          return pos;
        }

        return lockAxisRef.current === 'x'
          ? { x: startPos.x, y: pos.y }
          : { x: pos.x, y: startPos.y };
      }}
      onDragMove={(e) => {
        onDragMove?.(textElement.id, e);
      }}
      onDragEnd={(e) => {
        const handled = onDragEnd?.(textElement.id, e);
        resetDragState();
        if (!handled && onUpdate) {
          onUpdate(textElement.id, {
            x: e.target.x(),
            y: e.target.y(),
          });
        }
      }}
      onTransformEnd={(e) => {
        // Skip when multi-selected — group Transformer handles batch update
        if (isMultiSelected) return;

        const node = e.target as Konva.Text;
        const scaleY = node.scaleY();

        node.scaleX(1);
        node.scaleY(1);

        if (onUpdate) {
          onUpdate(textElement.id, {
            x: node.x(),
            y: node.y(),
            fontSize: Math.max(10, textElement.fontSize * scaleY),
            rotation: node.rotation(),
          });
        }
      }}
    />
  );
};

// Memo to prevent unnecessary re-renders
export const TextRenderer = memo(TextRendererComponent, (prevProps, nextProps) => {
  return (
    prevProps.textElement.id === nextProps.textElement.id &&
    prevProps.textElement.text === nextProps.textElement.text &&
    prevProps.textElement.x === nextProps.textElement.x &&
    prevProps.textElement.y === nextProps.textElement.y &&
    prevProps.textElement.fontSize === nextProps.textElement.fontSize &&
    prevProps.textElement.fontFamily === nextProps.textElement.fontFamily &&
    prevProps.textElement.letterSpacing === nextProps.textElement.letterSpacing &&
    prevProps.textElement.lineHeight === nextProps.textElement.lineHeight &&
    prevProps.textElement.align === nextProps.textElement.align &&
    prevProps.textElement.fontWeight === nextProps.textElement.fontWeight &&
    prevProps.textElement.fill === nextProps.textElement.fill &&
    prevProps.textElement.fillEnabled === nextProps.textElement.fillEnabled &&
    prevProps.textElement.stroke === nextProps.textElement.stroke &&
    prevProps.textElement.strokeEnabled === nextProps.textElement.strokeEnabled &&
    prevProps.textElement.strokeWidth === nextProps.textElement.strokeWidth &&
    prevProps.textElement.rotation === nextProps.textElement.rotation &&
    prevProps.textElement.opacity === nextProps.textElement.opacity &&
    prevProps.textElement.visible === nextProps.textElement.visible &&
    prevProps.textElement.shadowEnabled === nextProps.textElement.shadowEnabled &&
    prevProps.textElement.shadowColor === nextProps.textElement.shadowColor &&
    prevProps.textElement.shadowBlur === nextProps.textElement.shadowBlur &&
    prevProps.textElement.shadowOffsetX === nextProps.textElement.shadowOffsetX &&
    prevProps.textElement.shadowOffsetY === nextProps.textElement.shadowOffsetY &&
    prevProps.textElement.shadowOpacity === nextProps.textElement.shadowOpacity &&
    prevProps.isShiftPressed === nextProps.isShiftPressed &&
    prevProps.isMultiDragging === nextProps.isMultiDragging &&
    prevProps.isMultiSelected === nextProps.isMultiSelected
  );
});
