import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  COVER_SIZE,
  MOCK_PUBLIC_PATH,
  ensureCoverFontsReady,
  loadImageElement,
  renderCover,
} from '../utils/coverComposer';

// Admin-only lab for tuning the package cover layout before it is
// locked into the headless production output builder.
export function CoverLab() {
  const { user, profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mockRef = useRef<HTMLImageElement | null>(null);
  const wallpaperRef = useRef<HTMLImageElement | null>(null);

  const [episodeCode, setEpisodeCode] = useState('#0439');
  const [wallpaperReady, setWallpaperReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the mock once.
  useEffect(() => {
    let active = true;
    loadImageElement(MOCK_PUBLIC_PATH)
      .then((img) => {
        if (active) {
          mockRef.current = img;
          draw();
        }
      })
      .catch((err) => setError(String(err)));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draw = async () => {
    const canvas = canvasRef.current;
    const mock = mockRef.current;
    const wallpaper = wallpaperRef.current;
    if (!canvas || !mock || !wallpaper) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    await ensureCoverFontsReady();
    renderCover(ctx, { wallpaper, mock, episodeCode });
  };

  // Redraw when episode code changes.
  useEffect(() => {
    void draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeCode, wallpaperReady]);

  const onWallpaperPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImageElement(url);
      wallpaperRef.current = img;
      setWallpaperReady(true);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const onDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const link = document.createElement('a');
    link.download = `cover-${episodeCode.replace('#', '')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-6">
      <h1 className="text-xl font-bold mb-4">Cover Lab</h1>
      <p className="text-sm text-neutral-400 mb-6">
        Tune the package cover layout. Pick an HD wallpaper (1080×1920), set the
        episode code, then iterate. Layout values live in
        <code className="mx-1 px-1 bg-neutral-800 rounded">coverComposer.ts</code>.
      </p>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="text-sm">
          Wallpaper:
          <input
            type="file"
            accept="image/*"
            onChange={onWallpaperPick}
            className="ml-2 text-sm"
          />
        </label>
        <label className="text-sm">
          Episode:
          <input
            type="text"
            value={episodeCode}
            onChange={(e) => setEpisodeCode(e.target.value)}
            className="ml-2 px-2 py-1 bg-neutral-800 rounded text-sm w-28"
          />
        </label>
        <button
          type="button"
          onClick={onDownload}
          disabled={!wallpaperReady}
          className="px-4 py-1.5 bg-white text-black rounded text-sm font-medium disabled:opacity-40"
        >
          Download PNG
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {!wallpaperReady && (
        <p className="text-amber-400 text-sm mb-4">
          Pick an HD wallpaper to preview the cover.
        </p>
      )}

      <div className="inline-block border border-neutral-700 bg-neutral-800">
        <canvas
          ref={canvasRef}
          width={COVER_SIZE}
          height={COVER_SIZE}
          className="block"
          style={{ width: 640, height: 640 }}
        />
      </div>
    </div>
  );
}
