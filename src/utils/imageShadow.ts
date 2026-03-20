/**
 * Create a black silhouette from an image URL.
 * Loads the image, draws it on an offscreen canvas, then uses
 * globalCompositeOperation 'source-in' to fill all opaque pixels black
 * while preserving the original alpha channel.
 * Returns a Blob of the silhouette PNG.
 */
export const createSilhouetteBlob = (src: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Fill all opaque pixels with black, preserving alpha
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create silhouette blob'));
        }
      }, 'image/png');
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
};
