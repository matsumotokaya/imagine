import { useRef, useEffect, useState, memo } from 'react';
import Konva from 'konva';
import { Image as KonvaImage } from 'react-konva';
import type { ImageElement } from '../../types/template';

const alphaPremultiplyFilter = (imageData: ImageData) => {
  const { data } = imageData;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] / 255;
    data[i] = Math.round(data[i] * alpha);
    data[i + 1] = Math.round(data[i + 1] * alpha);
    data[i + 2] = Math.round(data[i + 2] * alpha);
  }
};

interface ImageRendererProps {
  imageElement: ImageElement;
  isShiftPressed: boolean;
  isMultiDragging: boolean;
  isMultiSelected: boolean;
  onSelect: (id: string, event: Konva.KonvaEventObject<MouseEvent | Event>) => void;
  onUpdate?: (id: string, updates: Partial<ImageElement>) => void;
  onDragStart?: (id: string, event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove?: (id: string, event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd?: (id: string, event: Konva.KonvaEventObject<DragEvent>) => boolean;
  nodeRef: (node: Konva.Image | null, id: string) => void;
  onImageLoad?: (id: string, status: 'loaded' | 'error') => void;
}

const ImageRendererComponent = ({
  imageElement,
  isShiftPressed,
  isMultiDragging,
  isMultiSelected,
  onSelect,
  onUpdate,
  onDragStart,
  onDragMove,
  onDragEnd,
  nodeRef,
  onImageLoad,
}: ImageRendererProps) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lockAxisRef = useRef<'x' | 'y' | null>(null);
  const localNodeRef = useRef<Konva.Image | null>(null);

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

  useEffect(() => {
    const loadImage = async () => {
      const img = new window.Image();

      // Check if this is a Supabase Storage URL
      const isSupabaseUrl = imageElement.src.includes('supabase');

      if (isSupabaseUrl && !imageElement.src.startsWith('blob:')) {
        // If it's a Supabase URL, download it as Blob to avoid CORS issues
        try {
          // Extract bucket name and path from URL
          const url = new URL(imageElement.src);
          const pathParts = url.pathname.split('/');
          const bucketIndex = pathParts.findIndex(part => part === 'object' || part === 'public') + 1;
          const bucketName = pathParts[bucketIndex];
          const storagePath = pathParts.slice(bucketIndex + 1).join('/');

          console.log('Loading Supabase image:', { bucketName, storagePath });

          const { getSupabase } = await import('../../utils/supabase');
          const supabase = await getSupabase();
          const { data, error } = await supabase.storage.from(bucketName).download(storagePath);

          if (error) {
            console.error('Error downloading image from Supabase:', error);
            // Fallback to direct load with CORS
            img.crossOrigin = 'anonymous';
            img.src = imageElement.src;
          } else {
            // Create Blob URL
            const blobUrl = URL.createObjectURL(data);
            img.src = blobUrl;
          }
        } catch (error) {
          console.error('Error processing Supabase URL:', error);
          // Fallback to direct load with CORS
          img.crossOrigin = 'anonymous';
          img.src = imageElement.src;
        }
      } else {
        // For non-Supabase URLs or already Blob URLs, load normally
        if (!imageElement.src.startsWith('blob:')) {
          img.crossOrigin = 'anonymous';
        }
        img.src = imageElement.src;
      }

      img.onload = () => {
        setImage(img);
        onImageLoad?.(imageElement.id, 'loaded');
      };
      img.onerror = (error) => {
        console.error('Failed to load image:', imageElement.src, error);
        onImageLoad?.(imageElement.id, 'error');
      };
    };

    loadImage();
  }, [imageElement.src]);

  useEffect(() => {
    const node = localNodeRef.current;
    if (!node || !image) {
      return;
    }

    if ((imageElement.blurRadius ?? 0) > 0) {
      node.clearCache();
      node.cache({
        offset: Math.max(16, Math.ceil((imageElement.blurRadius ?? 0) * 2)),
      });
    } else {
      node.clearCache();
    }

    node.getLayer()?.batchDraw();
  }, [image, imageElement.blurRadius, imageElement.width, imageElement.height]);

  return (
    <KonvaImage
      ref={(node) => {
        localNodeRef.current = node;
        nodeRef(node, imageElement.id);
      }}
      image={image || undefined}
      filters={(imageElement.blurRadius ?? 0) > 0 ? [alphaPremultiplyFilter, Konva.Filters.Blur] : []}
      blurRadius={imageElement.blurRadius ?? 0}
      x={imageElement.x}
      y={imageElement.y}
      width={imageElement.width}
      height={imageElement.height}
      shadowEnabled={imageElement.shadowEnabled ?? false}
      shadowColor={imageElement.shadowColor ?? '#000000'}
      shadowBlur={imageElement.shadowBlur ?? 4}
      shadowOffsetX={imageElement.shadowOffsetX ?? 2}
      shadowOffsetY={imageElement.shadowOffsetY ?? 2}
      shadowOpacity={imageElement.shadowOpacity ?? 0.5}
      rotation={imageElement.rotation || 0}
      opacity={imageElement.opacity ?? 1}
      visible={imageElement.visible ?? true}
      draggable={!imageElement.locked && (imageElement.visible ?? true)}
      listening={!imageElement.locked && (imageElement.visible ?? true)}
      onMouseDown={(e) => onSelect(imageElement.id, e)}
      onTouchStart={(e) => onSelect(imageElement.id, e)}
      onTap={(e) => onSelect(imageElement.id, e)}
      onDragStart={(e) => {
        dragStartPosRef.current = e.target.getAbsolutePosition();
        lockAxisRef.current = null;
        onDragStart?.(imageElement.id, e);
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
        onDragMove?.(imageElement.id, e);
      }}
      onDragEnd={(e) => {
        const handled = onDragEnd?.(imageElement.id, e);
        resetDragState();
        if (!handled && onUpdate) {
          onUpdate(imageElement.id, {
            x: e.target.x(),
            y: e.target.y(),
          });
        }
      }}
      onTransformEnd={(e) => {
        // Skip when multi-selected — group Transformer handles batch update
        if (isMultiSelected) return;

        const node = e.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        // Reset scale and apply to width/height
        node.scaleX(1);
        node.scaleY(1);

        if (onUpdate) {
          onUpdate(imageElement.id, {
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }
      }}
    />
  );
};

// Memo to prevent unnecessary re-renders
export const ImageRenderer = memo(ImageRendererComponent, (prevProps, nextProps) => {
  const prevImage = prevProps.imageElement;
  const nextImage = nextProps.imageElement;

  return (
    prevImage.id === nextImage.id &&
    prevImage.src === nextImage.src &&
    prevImage.x === nextImage.x &&
    prevImage.y === nextImage.y &&
    prevImage.width === nextImage.width &&
    prevImage.height === nextImage.height &&
    prevImage.rotation === nextImage.rotation &&
    prevImage.opacity === nextImage.opacity &&
    prevImage.locked === nextImage.locked &&
    prevImage.visible === nextImage.visible &&
    prevImage.shadowEnabled === nextImage.shadowEnabled &&
    prevImage.shadowColor === nextImage.shadowColor &&
    prevImage.shadowBlur === nextImage.shadowBlur &&
    prevImage.shadowOffsetX === nextImage.shadowOffsetX &&
    prevImage.shadowOffsetY === nextImage.shadowOffsetY &&
    prevImage.shadowOpacity === nextImage.shadowOpacity &&
    prevImage.blurRadius === nextImage.blurRadius &&
    prevProps.isShiftPressed === nextProps.isShiftPressed &&
    prevProps.isMultiDragging === nextProps.isMultiDragging &&
    prevProps.isMultiSelected === nextProps.isMultiSelected
  );
});
