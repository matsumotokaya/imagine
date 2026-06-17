// Shared size category definitions and utility functions
// Used by BannerManager, TemplateGallery, BannersBySize, TemplatesBySize, CanvasSizeSelector

export interface SizeCategory {
  key: string;
  label: string;
  width: number;
  height: number;
}

export const SIZE_CATEGORIES: readonly SizeCategory[] = [
  { key: 'phone', label: 'PHONE WALLPAPER', width: 1080, height: 1920 },
  { key: 'pc', label: 'PC WALLPAPER', width: 1920, height: 1080 },
  { key: 'youtube', label: 'YOUTUBE', width: 1280, height: 720 },
  { key: 'ogp', label: 'OGP IMAGE', width: 1200, height: 630 },
  { key: 'note', label: 'NOTE', width: 1280, height: 670 },
  { key: 'square', label: 'INSTAGRAM SQUARE', width: 1080, height: 1080 },
  { key: 'instagramFeed', label: 'INSTAGRAM FEED', width: 1080, height: 1350 },
  { key: 'twitterHeader', label: 'X HEADER', width: 1500, height: 500 },
];

const CUSTOM_SIZE_KEY_PREFIX = 'size-';

const KNOWN_DIMENSION_LABELS: Record<string, string> = {
  '1080x1920': 'PHONE WALLPAPER',
  '1920x1080': 'PC WALLPAPER',
  '1080x1350': 'INSTAGRAM FEED',
  '1440x2560': 'MOBILE QHD WALLPAPER',
  '2560x1440': 'PC QHD WALLPAPER',
  '1600x1600': 'PACKAGE COVER',
};

const buildDimensionKey = (width: number, height: number) => `${width}x${height}`;

export const buildCustomSizeKey = (width: number, height: number): string =>
  `${CUSTOM_SIZE_KEY_PREFIX}${width}x${height}`;

export const getSizeCategoryLabel = (width: number, height: number): string => {
  const known = KNOWN_DIMENSION_LABELS[buildDimensionKey(width, height)];
  if (known) {
    return known;
  }

  if (width === height) {
    return `CUSTOM SQUARE ${width}`;
  }

  if (height > width) {
    return `CUSTOM PORTRAIT ${width}x${height}`;
  }

  return `CUSTOM LANDSCAPE ${width}x${height}`;
};

export const createDynamicSizeCategory = (width: number, height: number): SizeCategory => ({
  key: buildCustomSizeKey(width, height),
  label: getSizeCategoryLabel(width, height),
  width,
  height,
});

export const resolveSizeCategory = <T extends { width?: number; height?: number }>(
  sizeKey: string | undefined,
  items: T[] = [],
): SizeCategory | undefined => {
  if (!sizeKey) {
    return undefined;
  }

  const fixed = SIZE_CATEGORIES.find((category) => category.key === sizeKey);
  if (fixed) {
    return fixed;
  }

  if (!sizeKey.startsWith(CUSTOM_SIZE_KEY_PREFIX)) {
    return undefined;
  }

  const [widthPart, heightPart] = sizeKey.slice(CUSTOM_SIZE_KEY_PREFIX.length).split('x');
  const width = Number(widthPart);
  const height = Number(heightPart);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  const existsInItems = items.some((item) => item.width === width && item.height === height);
  if (!existsInItems) {
    return undefined;
  }

  return createDynamicSizeCategory(width, height);
};

export const getAvailableSizeCategories = <T extends { width?: number; height?: number }>(
  items: T[],
): SizeCategory[] => {
  const seen = new Set<string>();
  const categories: SizeCategory[] = [];

  for (const category of SIZE_CATEGORIES) {
    if (items.some((item) => item.width === category.width && item.height === category.height)) {
      categories.push(category);
      seen.add(buildDimensionKey(category.width, category.height));
    }
  }

  const extras = Array.from(
    new Set(
      items
        .filter((item) => item.width && item.height)
        .map((item) => buildDimensionKey(item.width as number, item.height as number)),
    ),
  )
    .filter((dimensionKey) => !seen.has(dimensionKey))
    .map((dimensionKey) => {
      const [widthPart, heightPart] = dimensionKey.split('x');
      return createDynamicSizeCategory(Number(widthPart), Number(heightPart));
    })
    .sort((a, b) => {
      const areaDiff = b.width * b.height - a.width * a.height;
      if (areaDiff !== 0) {
        return areaDiff;
      }

      if (a.height !== b.height) {
        return b.height - a.height;
      }

      return b.width - a.width;
    });

  return [...categories, ...extras];
};

// Get CSS aspect ratio class based on dimensions
export const getAspectClass = (width?: number, height?: number): string => {
  if (!width || !height) return 'aspect-[9/16]';
  if (width > height) return 'aspect-[16/9]';
  if (width === height) return 'aspect-square';
  return 'aspect-[9/16]';
};

// Get responsive grid columns class based on aspect ratio
export const getGridCols = (width: number, height: number): string => {
  if (width > height) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  if (width === height) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
};

// Filter items by size (works with any object that has width/height)
export const filterBySize = <T extends { width?: number; height?: number }>(
  items: T[],
  targetWidth: number,
  targetHeight: number,
): T[] => {
  return items.filter((item) => item.width === targetWidth && item.height === targetHeight);
};

// Default sizes shown in the sidebar (most commonly used)
export const DEFAULT_SIZES: readonly SizeCategory[] = [
  { key: 'phone', label: 'MOBILE WALLPAPER', width: 1080, height: 1920 },
  { key: 'pc', label: 'PC WALLPAPER', width: 1920, height: 1080 },
  { key: 'youtube', label: 'YOUTUBE THUMBNAIL', width: 1280, height: 720 },
  { key: 'x-post', label: 'X POST', width: 1600, height: 900 },
  { key: 'ig-stories', label: 'INSTAGRAM STORIES', width: 1080, height: 1920 },
  { key: 'fb-post', label: 'FACEBOOK POST', width: 1200, height: 630 },
  { key: 'tiktok', label: 'TIKTOK', width: 1080, height: 1920 },
  { key: 'ogp', label: 'OGP IMAGE', width: 1200, height: 630 },
];

// All size presets grouped by platform/use case (for modal)
export interface SizePresetGroup {
  groupKey: string;
  groupLabel: string;
  presets: SizeCategory[];
}

export const ALL_SIZE_PRESETS: readonly SizePresetGroup[] = [
  {
    groupKey: 'instagram',
    groupLabel: 'Instagram',
    presets: [
      { key: 'ig-stories', label: 'Stories / Reels', width: 1080, height: 1920 },
      { key: 'ig-square', label: 'Square', width: 1080, height: 1080 },
      { key: 'ig-feed', label: 'Feed (Portrait)', width: 1080, height: 1350 },
      { key: 'ig-landscape', label: 'Landscape', width: 1080, height: 566 },
    ],
  },
  {
    groupKey: 'x',
    groupLabel: 'X (Twitter)',
    presets: [
      { key: 'x-post', label: 'Post', width: 1600, height: 900 },
      { key: 'x-header', label: 'Header', width: 1500, height: 500 },
    ],
  },
  {
    groupKey: 'facebook',
    groupLabel: 'Facebook',
    presets: [
      { key: 'fb-post', label: 'Post / Link Share', width: 1200, height: 630 },
      { key: 'fb-cover', label: 'Cover Photo', width: 851, height: 315 },
      { key: 'fb-event', label: 'Event Cover', width: 1920, height: 1005 },
    ],
  },
  {
    groupKey: 'youtube',
    groupLabel: 'YouTube',
    presets: [
      { key: 'yt-thumb', label: 'Thumbnail', width: 1280, height: 720 },
      { key: 'yt-banner', label: 'Channel Banner', width: 2560, height: 1440 },
    ],
  },
  {
    groupKey: 'tiktok',
    groupLabel: 'TikTok',
    presets: [
      { key: 'tt-thumb', label: 'Video Thumbnail', width: 1080, height: 1920 },
    ],
  },
  {
    groupKey: 'pinterest',
    groupLabel: 'Pinterest',
    presets: [
      { key: 'pin', label: 'Pin', width: 1000, height: 1500 },
    ],
  },
  {
    groupKey: 'linkedin',
    groupLabel: 'LinkedIn',
    presets: [
      { key: 'li-post', label: 'Post', width: 1200, height: 627 },
      { key: 'li-cover', label: 'Cover', width: 1584, height: 396 },
    ],
  },
  {
    groupKey: 'line',
    groupLabel: 'LINE',
    presets: [
      { key: 'line-rich', label: 'Rich Message', width: 1040, height: 1040 },
      { key: 'line-menu-lg', label: 'Rich Menu (Large)', width: 2500, height: 1686 },
      { key: 'line-menu-sm', label: 'Rich Menu (Small)', width: 2500, height: 843 },
    ],
  },
  {
    groupKey: 'blog',
    groupLabel: 'Blog / Web',
    presets: [
      { key: 'ogp', label: 'OGP', width: 1200, height: 630 },
      { key: 'note', label: 'note', width: 1280, height: 670 },
    ],
  },
  {
    groupKey: 'ads',
    groupLabel: 'Web Ads',
    presets: [
      { key: 'ad-responsive', label: 'Responsive Display', width: 1200, height: 628 },
      { key: 'ad-medium-rect', label: 'Medium Rectangle', width: 300, height: 250 },
      { key: 'ad-large-rect', label: 'Large Rectangle', width: 336, height: 280 },
      { key: 'ad-leaderboard', label: 'Leaderboard', width: 728, height: 90 },
      { key: 'ad-skyscraper', label: 'Skyscraper', width: 160, height: 600 },
      { key: 'ad-billboard', label: 'Billboard', width: 970, height: 250 },
    ],
  },
  {
    groupKey: 'wallpaper',
    groupLabel: 'Wallpaper / Presentation',
    presets: [
      { key: 'wp-fhd', label: 'PC (Full HD)', width: 1920, height: 1080 },
      { key: 'wp-4k', label: 'PC (4K)', width: 3840, height: 2160 },
      { key: 'wp-mobile', label: 'Mobile', width: 1080, height: 1920 },
      { key: 'wp-ppt43', label: 'Presentation (4:3)', width: 1024, height: 768 },
    ],
  },
];
