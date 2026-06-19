// Headless cover compositor for Content Factory package covers.
// Renders a 1600x1600 promo cover: blurred wallpaper background,
// phone mock with the wallpaper fitted into its transparent screen,
// and a grid-aligned promo text block on the left. The same function
// powers the live preview lab and (after layout lock) the production
// output builder.

export const COVER_SIZE = 1600;

// iphone-mock.png natural size and the transparent screen hole (measured).
export const MOCK_NATURAL_WIDTH = 1500;
export const MOCK_NATURAL_HEIGHT = 3037;
export const MOCK_SCREEN = { x: 69, y: 55, width: 1357, height: 2922 };
// Screen corner radius in mock-natural px (used to trim wallpaper corners).
export const MOCK_SCREEN_CORNER_RADIUS = 175;

export const MOCK_PUBLIC_PATH = '/mocks/iphone-mock.png';

// All tunable layout values live here so the preview lab and the final
// headless build share one source of truth.
export const COVER_LAYOUT = {
  background: {
    blurRadius: 18,
    overlayColor: 'rgba(20, 20, 22, 0.42)',
  },
  // Equal-gutter 2-column system: outer margin (M) == column gutter (G).
  // Left typography column gets [M, leftWidth]; phone column sits on the
  // right with an M margin and a G gutter from the text column.
  margin: 90,
  phone: {
    // Target on-canvas height of the phone; width derives from aspect.
    height: 1360,
    // Vertical center offset (0 = centered).
    offsetY: 0,
    shadow: {
      color: 'rgba(0, 0, 0, 0.68)',
      fill: 'rgba(0, 0, 0, 0.28)',
      blur: 64,
      offsetX: 38,
      offsetY: 66,
      inset: 28,
      radius: 150,
    },
  },
  // Left promo block — a single aligned grid: every row shares `left`
  // and `width`, so the FREE badge and the episode bar end on the same
  // right edge.
  leftBlock: {
    // left / width are derived from `margin` and the phone column at
    // render time so the gutters stay equal.
    color: '#ffffff',

    title: {
      text: 'WHATIF',
      baselineY: 626,
      fontSize: 159,
      fontFamily: '"Arial Black", Arial, sans-serif',
      // Negative tracking pulls the heavy caps tight like the sample.
      letterSpacing: -4,
    },
    subtitle: {
      text: 'WALLPAPER PACK',
      baselineY: 720,
      fontSize: 54,
      fontWeight: 700,
      fontFamily: 'Arial, sans-serif',
      letterSpacing: 0,
      badge: {
        text: 'PRO',
        fontSize: 32,
        fontWeight: 700,
        gapBefore: 22,
        paddingX: 16,
        height: 46,
        radius: 8,
        bg: '#141416',
        textColor: '#ffffff',
      },
    },
    supportLine: {
      text: 'PHONE + DESKTOP',
      baselineY: 788,
      fontSize: 54,
      fontWeight: 700,
      fontFamily: 'Arial, sans-serif',
      letterSpacing: 0,
      color: '#ffffff',
    },
    episodeBar: {
      top: 838,
      height: 78,
      gap: 8,
      labelRatio: 0.6,
      radius: 8,
      textOffsetY: 4,
      label: 'EPISODE',
      labelBg: 'rgba(255, 255, 255, 0.16)',
      codeBg: '#ffffff',
      labelColor: '#ffffff',
      codeColor: '#141416',
      fontSize: 38,
      fontWeight: 700,
      fontFamily: 'Arial, sans-serif',
    },
    metaRow: {
      top: 994,
      iconSize: 34,
      iconTextGap: 16,
      iconFontFamily: '"Material Symbols Outlined"',
      iconColor: 'rgba(255,255,255,0.95)',
      specFontSize: 27,
      specLineGap: 44,
      specFontFamily: 'Arial, sans-serif',
      specColor: 'rgba(255,255,255,0.95)',
      specRows: [
        { icon: 'smartphone', text: 'FULL HD [1080px / 1920px]' },
        { icon: 'smartphone', text: '2K / QUAD HD [1440px / 2560px]' },
        { icon: 'desktop_windows', text: 'FULL HD [1920px / 1080px]' },
        { icon: 'desktop_windows', text: '2K / QUAD HD [2560px / 1440px]' },
      ],
    },
  },
};

export interface CoverRenderOptions {
  wallpaper: CanvasImageSource;
  mock: CanvasImageSource;
  episodeCode: string; // e.g. "#0439"
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const scale = Math.max(dw / sw, dh / sh);
  const cropW = dw / scale;
  const cropH = dh / scale;
  const sx = (sw - cropW) / 2;
  const sy = (sh - cropH) / 2;
  ctx.drawImage(img, sx, sy, cropW, cropH, dx, dy, dw, dh);
}

function getImageSize(img: CanvasImageSource): { width: number; height: number } {
  if (img instanceof HTMLImageElement) {
    return { width: img.naturalWidth, height: img.naturalHeight };
  }
  if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) {
    return { width: img.width, height: img.height };
  }
  const anyImg = img as unknown as { width: number; height: number };
  return { width: anyImg.width, height: anyImg.height };
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// Draw text with manual letter spacing (canvas letterSpacing support is
// uneven across engines, so we advance glyph by glyph).
function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
): number {
  if (!tracking) {
    ctx.fillText(text, x, y);
    return ctx.measureText(text).width;
  }
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
  return cursor - x - tracking;
}

export function renderCover(
  ctx: CanvasRenderingContext2D,
  options: CoverRenderOptions,
): void {
  const { wallpaper, mock, episodeCode } = options;
  const size = COVER_SIZE;
  const wp = getImageSize(wallpaper);

  ctx.clearRect(0, 0, size, size);

  // 1) Blurred wallpaper background (cover-cropped to the full square).
  ctx.save();
  ctx.filter = `blur(${COVER_LAYOUT.background.blurRadius}px)`;
  const bleed = COVER_LAYOUT.background.blurRadius * 2;
  drawImageCover(ctx, wallpaper, wp.width, wp.height, -bleed, -bleed, size + bleed * 2, size + bleed * 2);
  ctx.restore();

  ctx.fillStyle = COVER_LAYOUT.background.overlayColor;
  ctx.fillRect(0, 0, size, size);

  // 2) Phone mock with the wallpaper fitted into the transparent screen.
  const margin = COVER_LAYOUT.margin;
  const phoneScale = COVER_LAYOUT.phone.height / MOCK_NATURAL_HEIGHT;
  const phoneW = MOCK_NATURAL_WIDTH * phoneScale;
  const phoneH = COVER_LAYOUT.phone.height;
  const phoneX = size - phoneW - margin;
  const phoneY = (size - phoneH) / 2 + COVER_LAYOUT.phone.offsetY;

  const screenX = phoneX + MOCK_SCREEN.x * phoneScale;
  const screenY = phoneY + MOCK_SCREEN.y * phoneScale;
  const screenW = MOCK_SCREEN.width * phoneScale;
  const screenH = MOCK_SCREEN.height * phoneScale;
  const screenRadius = MOCK_SCREEN_CORNER_RADIUS * phoneScale;

  // Add a soft directional shadow so the device sits above the background
  // without turning into a heavy card.
  const phoneShadow = COVER_LAYOUT.phone.shadow;
  ctx.save();
  ctx.shadowColor = phoneShadow.color;
  ctx.shadowBlur = phoneShadow.blur;
  ctx.shadowOffsetX = phoneShadow.offsetX;
  ctx.shadowOffsetY = phoneShadow.offsetY;
  ctx.fillStyle = phoneShadow.fill;
  roundRectPath(
    ctx,
    phoneX + phoneShadow.inset,
    phoneY + phoneShadow.inset,
    phoneW - phoneShadow.inset * 2,
    phoneH - phoneShadow.inset * 2,
    phoneShadow.radius * phoneScale,
  );
  ctx.fill();
  ctx.restore();

  // Clip the wallpaper to the rounded screen so corners are trimmed,
  // then overlay the frame (dynamic island occludes from the PNG).
  ctx.save();
  roundRectPath(ctx, screenX, screenY, screenW, screenH, screenRadius);
  ctx.clip();
  drawImageCover(ctx, wallpaper, wp.width, wp.height, screenX, screenY, screenW, screenH);
  ctx.restore();
  ctx.drawImage(mock, phoneX, phoneY, phoneW, phoneH);

  // 3) Promo text block (left column). Width spans from the outer margin
  // to a gutter (== margin) before the phone, keeping all gaps equal.
  const blockLeft = margin;
  const blockWidth = phoneX - margin - blockLeft;
  drawLeftBlock(ctx, episodeCode, blockLeft, blockWidth);
}

function drawLeftBlock(
  ctx: CanvasRenderingContext2D,
  episodeCode: string,
  left: number,
  width: number,
): void {
  const block = COVER_LAYOUT.leftBlock;

  // --- Title ---
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = block.color;
  ctx.font = `${block.title.fontSize}px ${block.title.fontFamily}`;
  drawTrackedText(ctx, block.title.text, left, block.title.baselineY, block.title.letterSpacing);

  // --- Subtitle + PRO badge ---
  const sub = block.subtitle;
  ctx.fillStyle = block.color;
  ctx.font = `${sub.fontWeight} ${sub.fontSize}px ${sub.fontFamily}`;
  const subWidth = drawTrackedText(ctx, sub.text, left, sub.baselineY, sub.letterSpacing);

  // Badge sits right after the text, vertically centered on the
  // subtitle's optical center (cap height ~= 0.72 of font size).
  const badge = sub.badge;
  const subCenterY = sub.baselineY - sub.fontSize * 0.72 * 0.5;
  ctx.font = `${badge.fontWeight} ${badge.fontSize}px ${sub.fontFamily}`;
  const badgeTextW = ctx.measureText(badge.text).width;
  const badgeW = badgeTextW + badge.paddingX * 2;
  const badgeX = left + subWidth + badge.gapBefore;
  const badgeY = subCenterY - badge.height / 2;
  ctx.fillStyle = badge.bg;
  roundRectPath(ctx, badgeX, badgeY, badgeW, badge.height, badge.radius);
  ctx.fill();
  ctx.fillStyle = badge.textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(badge.text, badgeX + badgeW / 2, subCenterY + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // --- Device support line ---
  const supportLine = block.supportLine;
  ctx.fillStyle = supportLine.color;
  ctx.font = `${supportLine.fontWeight} ${supportLine.fontSize}px ${supportLine.fontFamily}`;
  drawTrackedText(ctx, supportLine.text, left, supportLine.baselineY, supportLine.letterSpacing);

  // --- EPISODE bar (label cell + code cell, shared width) ---
  const bar = block.episodeBar;
  const labelW = Math.round(width * bar.labelRatio);
  const codeX = left + labelW + bar.gap;
  const codeW = width - labelW - bar.gap;

  ctx.fillStyle = bar.labelBg;
  roundRectPath(ctx, left, bar.top, labelW, bar.height, bar.radius);
  ctx.fill();
  ctx.fillStyle = bar.codeBg;
  roundRectPath(ctx, codeX, bar.top, codeW, bar.height, bar.radius);
  ctx.fill();

  ctx.font = `${bar.fontWeight} ${bar.fontSize}px ${bar.fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = bar.labelColor;
  ctx.fillText(bar.label, left + labelW / 2, bar.top + bar.height / 2 + bar.textOffsetY);
  ctx.fillStyle = bar.codeColor;
  ctx.fillText(episodeCode, codeX + codeW / 2, bar.top + bar.height / 2 + bar.textOffsetY);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // --- Meta row: 4 line icons + spec text ---
  const meta = block.metaRow;
  ctx.fillStyle = meta.specColor;
  ctx.font = `${meta.specFontSize}px ${meta.specFontFamily}`;
  ctx.textBaseline = 'middle';
  meta.specRows.forEach((row, index) => {
    const centerY = meta.top + index * meta.specLineGap;
    drawSpecIcon(ctx, left, centerY, row.icon, meta);
    ctx.fillText(row.text, left + meta.iconSize + meta.iconTextGap, centerY);
  });
  ctx.textBaseline = 'alphabetic';
}

// Material Symbols Outlined ligatures are shaped by the browser canvas
// text engine into glyphs.
function drawSpecIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  centerY: number,
  iconName: string,
  meta: typeof COVER_LAYOUT.leftBlock.metaRow,
): void {
  ctx.save();
  ctx.fillStyle = meta.iconColor;
  ctx.font = `${meta.iconSize}px ${meta.iconFontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(iconName, x, centerY + 1);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// Ensure the promo fonts are ready before rendering text (headless-safe).
export async function ensureCoverFontsReady(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return;
  }
  const specs = [
    '186px "Arial Black"',
    'bold 54px Arial',
    'bold 38px Arial',
    '30px Arial',
    '44px "Material Symbols Outlined"',
  ];
  try {
    await Promise.all(specs.map((spec) => (document as Document).fonts.load(spec)));
    await (document as Document).fonts.ready;
  } catch {
    // Font loading best-effort; fall back to default rendering.
  }
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
