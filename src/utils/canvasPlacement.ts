export interface FitToCanvasPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getFitToCanvasPlacement(
  canvasWidth: number,
  canvasHeight: number,
  contentWidth: number,
  contentHeight: number,
): FitToCanvasPlacement {
  const scale = Math.min(canvasWidth / contentWidth, canvasHeight / contentHeight);
  const width = contentWidth * scale;
  const height = contentHeight * scale;

  return {
    width,
    height,
    x: (canvasWidth - width) / 2,
    y: (canvasHeight - height) / 2,
  };
}
