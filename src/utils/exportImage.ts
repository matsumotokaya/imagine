export type ExportMethod = 'share-files' | 'blob-download' | 'dataurl-fallback';

export interface ExportImageResult {
  method: ExportMethod;
  inAppBrowser: boolean;
  isIOS: boolean;
}

const IN_APP_BROWSER_PATTERN = /(Instagram|FBAN|FBAV|Line|MicroMessenger|wv)/i;

const isIOSDevice = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document);
};

const isAndroidDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(window.navigator.userAgent);
};

const isDesktopLikeDevice = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const mobileUa = /Android|iPhone|iPad|iPod/i.test(ua);
  const hasCoarsePointer = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  return !mobileUa && !hasCoarsePointer;
};

const isInAppBrowser = () => {
  if (typeof window === 'undefined') return false;
  return IN_APP_BROWSER_PATTERN.test(window.navigator.userAgent);
};

const sanitizeFileName = (fileName: string) => {
  const cleaned = fileName.replace(/[\\/:*?"<>|]+/g, '-').trim();
  return cleaned.length > 0 ? cleaned : 'banner.png';
};

const getExtensionFromMimeType = (mimeType: string) => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return null;
};

const applyMimeExtension = (fileName: string, mimeType: string) => {
  const safeFileName = sanitizeFileName(fileName);
  const extension = getExtensionFromMimeType(mimeType);
  if (!extension) return safeFileName;

  const withoutExtension = safeFileName.replace(/\.[a-z0-9]+$/i, '');
  return `${withoutExtension}.${extension}`;
};

const triggerDownload = (href: string, fileName: string) => {
  try {
    const link = document.createElement('a');
    link.href = href;
    link.download = sanitizeFileName(fileName);
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch {
    return false;
  }
};

const dataUrlToBlob = async (dataURL: string) => {
  const response = await fetch(dataURL);
  return response.blob();
};

export const downloadImageFromUrl = async (url: string, fileName: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch download asset: ${response.status}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  triggerDownload(blobUrl, applyMimeExtension(fileName, blob.type));
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
};

export const exportImageFromDataUrl = async (dataURL: string, fileName: string): Promise<ExportImageResult> => {
  const inAppBrowser = isInAppBrowser();
  const isIOS = isIOSDevice();
  const isAndroid = isAndroidDevice();
  const isDesktopLike = isDesktopLikeDevice();

  const blob = await dataUrlToBlob(dataURL);
  const safeFileName = sanitizeFileName(fileName);
  const file = new File([blob], safeFileName, { type: blob.type || 'image/png' });

  const shareNavigator = window.navigator as Navigator & {
    share?: (data?: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };

  const canShareFile =
    typeof shareNavigator.share === 'function' &&
    (
      typeof shareNavigator.canShare !== 'function' ||
      shareNavigator.canShare({ files: [file] })
    );

  const tryShareFile = async () => {
    if (!canShareFile || typeof shareNavigator.share !== 'function') {
      return false;
    }

    try {
      await shareNavigator.share({
        files: [file],
        title: safeFileName,
      });
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      return false;
    }
  };

  const preferShareFirst = isIOS || (inAppBrowser && !isDesktopLike);

  if (preferShareFirst) {
    const shared = await tryShareFile();
    if (shared) {
      return {
        method: 'share-files',
        inAppBrowser,
        isIOS,
      };
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const blobDownloadTriggered = triggerDownload(blobUrl, safeFileName);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

  if (blobDownloadTriggered) {
    return {
      method: 'blob-download',
      inAppBrowser,
      isIOS,
    };
  }

  if (!preferShareFirst && (isAndroid || inAppBrowser || !isDesktopLike)) {
    const shared = await tryShareFile();
    if (shared) {
      return {
        method: 'share-files',
        inAppBrowser,
        isIOS,
      };
    }
  }

  triggerDownload(dataURL, safeFileName);
  return {
    method: 'dataurl-fallback',
    inAppBrowser,
    isIOS,
  };
};
