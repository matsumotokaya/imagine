import { useState, useRef, useEffect, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';

// iOS-style draggable bottom sheet with snap detents.
// The sheet is moved (resized) to adjust the visible range; the content is fixed
// (no internal scroll) and is simply revealed/clipped by the sheet height, so the
// only gesture is dragging the whole sheet up/down.
// medium / large detents are fractions of the visible viewport height.
const SHEET_MEDIUM_RATIO = 0.6;
const SHEET_LARGE_RATIO = 0.9;

// Peek is the initial / minimum visible height: just the drag handle plus about
// one row of content, so it never covers the selected object on the canvas.
// We combine a small viewport ratio with a fixed px floor and cap so tall phones
// do not turn "peek" into a large panel.
const SHEET_PEEK_PX = 120;
const SHEET_PEEK_RATIO = 0.16;
const SHEET_PEEK_MAX_PX = 160;

interface MobileSheetProps {
  children: ReactNode;
  // Called when the user drags the sheet down past the dismiss threshold and releases.
  onDismiss?: () => void;
}

export const MobileSheet = ({ children, onDismiss }: MobileSheetProps) => {
  const getDetents = () => {
    const vh = window.innerHeight;
    const peek = Math.min(SHEET_PEEK_MAX_PX, Math.max(SHEET_PEEK_PX, Math.round(vh * SHEET_PEEK_RATIO)));
    const medium = Math.round(vh * SHEET_MEDIUM_RATIO);
    const large = Math.round(vh * SHEET_LARGE_RATIO);
    return [peek, medium, large];
  };

  const detentsRef = useRef<number[]>(getDetents());
  const [height, setHeight] = useState(() => detentsRef.current[0]);
  const heightRef = useRef(height);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  // Entrance: start hidden below the screen, then slide up to the peek detent.
  const [entered, setEntered] = useState(false);

  const applyHeight = (h: number) => {
    heightRef.current = h;
    setHeight(h);
  };

  // Play the entrance slide-up one frame after mount so the transition runs.
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Keep detents in sync with viewport changes (rotation, URL bar show/hide).
  useEffect(() => {
    const onResize = () => {
      detentsRef.current = getDetents();
      const max = detentsRef.current[detentsRef.current.length - 1];
      if (heightRef.current > max) applyHeight(max);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handlePointerDown = (e: ReactPointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: heightRef.current };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    const detents = detentsRef.current;
    const min = Math.round(detents[0] * 0.45);
    const max = detents[detents.length - 1];
    const next = Math.min(max, Math.max(min, dragRef.current.startH - (e.clientY - dragRef.current.startY)));
    applyHeight(next);
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    const detents = detentsRef.current;
    // Dragged well below the peek detent -> dismiss.
    if (onDismiss && heightRef.current < detents[0] * 0.72) {
      onDismiss();
      return;
    }
    // Otherwise snap to the nearest detent.
    const nearest = detents.reduce(
      (best, d) => (Math.abs(d - heightRef.current) < Math.abs(best - heightRef.current) ? d : best),
      detents[0],
    );
    applyHeight(nearest);
  };

  // Before the entrance has played, push the sheet fully below the screen so the
  // first transition is a visible slide-up from the bottom edge.
  const translateY = entered ? 0 : height;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-[#1a1a1a]/90 backdrop-blur-md border-t border-[#2b2b2b] rounded-t-2xl shadow-2xl"
      style={{
        height,
        transform: `translateY(${translateY}px)`,
        transition: isDragging
          ? 'none'
          : 'height 0.28s cubic-bezier(0.32, 0.72, 0, 1), transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {/* Drag handle - pull up/down to resize, snaps to detents (or dismiss) */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="flex justify-center items-center pt-2.5 pb-2 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none"
      >
        <div className="w-10 h-1.5 bg-gray-500 rounded-full" />
      </div>
      <div className="flex-1 overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
};
