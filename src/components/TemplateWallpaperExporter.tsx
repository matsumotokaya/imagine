import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Canvas } from './Canvas';
import type { CanvasRef } from './Canvas';
import type { Template, TemplateRecord } from '../types/template';
import { exportImageFromDataUrl, type ExportImageResult } from '../utils/exportImage';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';

interface TemplateWallpaperExporterProps {
  template: TemplateRecord | null;
  onComplete: (result: ExportImageResult) => void;
  onError: (error: Error) => void;
}

const HIDDEN_WRAPPER_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: '-10000px',
  pointerEvents: 'none',
  opacity: 0,
};

export const TemplateWallpaperExporter = ({
  template,
  onComplete,
  onError,
}: TemplateWallpaperExporterProps) => {
  const canvasRef = useRef<CanvasRef>(null);
  const exportStartedRef = useRef(false);
  const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(new Set());

  const editorTemplate = useMemo<Template | null>(() => {
    if (!template) return null;

    const fallbackTemplate = DEFAULT_TEMPLATES[0];
    return {
      id: template.id,
      name: template.name,
      width: template.width ?? fallbackTemplate.width,
      height: template.height ?? fallbackTemplate.height,
      backgroundColor: template.canvasColor,
      thumbnail: template.thumbnailUrl,
      planType: template.planType,
    };
  }, [template]);

  const imageElements = useMemo(
    () => (template?.elements || []).filter((element) => element.type === 'image'),
    [template]
  );

  useEffect(() => {
    exportStartedRef.current = false;
    setLoadedImageIds(new Set());
  }, [template?.id]);

  useEffect(() => {
    if (!template || !editorTemplate || exportStartedRef.current) return;

    const allImagesSettled = loadedImageIds.size >= imageElements.length;
    if (imageElements.length > 0 && !allImagesSettled) {
      return;
    }

    exportStartedRef.current = true;

    const timeoutId = window.setTimeout(async () => {
      try {
        const dataURL = canvasRef.current?.exportImage() || '';
        if (!dataURL || dataURL.length < 100) {
          throw new Error('Template image generation failed');
        }

        const result = await exportImageFromDataUrl(dataURL, `${template.name}.png`);
        onComplete(result);
      } catch (error) {
        onError(error instanceof Error ? error : new Error('Template export failed'));
      }
    }, 120);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [editorTemplate, imageElements.length, loadedImageIds, onComplete, onError, template]);

  if (!template || !editorTemplate) {
    return null;
  }

  return (
    <div style={HIDDEN_WRAPPER_STYLE} aria-hidden="true">
      <Canvas
        ref={canvasRef}
        template={editorTemplate}
        elements={template.elements || []}
        canvasColor={template.canvasColor}
        scale={1}
        selectedElementIds={[]}
        onSelectElement={() => {}}
        onImageLoad={(id) => {
          setLoadedImageIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });
        }}
      />
    </div>
  );
};
