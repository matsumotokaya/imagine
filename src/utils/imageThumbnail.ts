// Shared client-side thumbnail generation for library images.
//
// Library assets (default_images / user_images) are uploaded as raw image
// files, not rendered from a Konva stage, so the banner thumbnail path
// (stage.toDataURL) does not apply. This util produces an equivalent
// JPEG / max-400px / quality 0.7 thumbnail from a File via a canvas, matching
// the banner/template thumbnail spec documented in docs/PERFORMANCE.md.

export const THUMBNAIL_MAX_DIMENSION = 400;
export const THUMBNAIL_JPEG_QUALITY = 0.7;

export interface GeneratedThumbnail {
  blob: Blob;
  width: number;
  height: number;
}

const loadImageElement = (objectUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = objectUrl;
  });

// Generate a JPEG thumbnail (max 400px on the longest edge, quality 0.7) from
// an image File. Returns null when the browser cannot encode the canvas, so
// callers can fall back to the full-size asset instead of failing the upload.
export const generateImageThumbnail = async (
  file: File
): Promise<GeneratedThumbnail | null> => {
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await loadImageElement(objectUrl);

    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) {
      return null;
    }

    const longestEdge = Math.max(sourceWidth, sourceHeight);
    const scale = longestEdge > THUMBNAIL_MAX_DIMENSION ? THUMBNAIL_MAX_DIMENSION / longestEdge : 1;
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/jpeg', THUMBNAIL_JPEG_QUALITY);
    });

    if (!blob) {
      return null;
    }

    return { blob, width: targetWidth, height: targetHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
