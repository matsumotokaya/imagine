import { getSupabase, getSupabaseStoragePublicUrl } from './supabase';

const DATA_URL_PREFIX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/;
const PUBLIC_OBJECT_PATH_SEGMENT = '/storage/v1/object/public/';

interface UploadOptions {
  upsert?: boolean;
}

const getExtensionFromMime = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'bin';
};

export const isDataUrlImage = (src: string): boolean => {
  return DATA_URL_PREFIX.test(src);
};

export const dataUrlToBlob = (dataUrl: string): { blob: Blob; mimeType: string; extension: string } => {
  const match = dataUrl.match(DATA_URL_PREFIX);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  const mimeType = match[1];
  const base64 = dataUrl.replace(DATA_URL_PREFIX, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return { blob, mimeType, extension: getExtensionFromMime(mimeType) };
};

export const uploadBlobToBucket = async (
  bucket: string,
  filePath: string,
  blob: Blob,
  contentType: string,
  options: UploadOptions = {}
): Promise<string> => {
  const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType,
      upsert: options.upsert ?? false,
    });

  if (error) {
    console.error('Storage upload failed:', error);
    throw error;
  }

  return getSupabaseStoragePublicUrl(bucket, filePath);
};

export const uploadDataUrlToBucket = async (
  dataUrl: string,
  bucket: string,
  filePathBase: string,
  options: UploadOptions = {}
): Promise<string> => {
  const { blob, mimeType, extension } = dataUrlToBlob(dataUrl);
  const filePath = `${filePathBase}.${extension}`;
  return uploadBlobToBucket(bucket, filePath, blob, mimeType, options);
};

export const uploadFileToBucket = async (
  file: File,
  bucket: string,
  filePathBase: string,
  options: UploadOptions = {}
): Promise<string> => {
  const extension = getExtensionFromMime(file.type || '');
  const filePath = `${filePathBase}.${extension}`;
  const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: options.upsert ?? false,
    });

  if (error) {
    console.error('Storage upload failed:', error);
    throw error;
  }

  return getSupabaseStoragePublicUrl(bucket, filePath);
};

export const appendCacheBust = (url: string, version?: string | null): string => {
  if (!version) return url;

  const [base, hash] = url.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  const versionedUrl = `${base}${separator}v=${encodeURIComponent(version)}`;
  return hash ? `${versionedUrl}#${hash}` : versionedUrl;
};

export const extractStoragePathFromPublicUrl = (
  publicUrl: string,
  bucket: string
): string | null => {
  try {
    const url = new URL(publicUrl);
    const objectPathIndex = url.pathname.indexOf(PUBLIC_OBJECT_PATH_SEGMENT);
    if (objectPathIndex === -1) {
      return null;
    }

    const objectPath = url.pathname.slice(objectPathIndex + PUBLIC_OBJECT_PATH_SEGMENT.length);
    if (!objectPath.startsWith(`${bucket}/`)) {
      return null;
    }

    const encodedStoragePath = objectPath.slice(bucket.length + 1);
    return encodedStoragePath
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    return null;
  }
};

export const removeFilesFromBucket = async (bucket: string, filePaths: string[]): Promise<void> => {
  const uniquePaths = [...new Set(filePaths.filter(Boolean))];
  if (uniquePaths.length === 0) return;

  const supabase = await getSupabase();
  const { error } = await supabase.storage.from(bucket).remove(uniquePaths);

  if (error) {
    console.error('Storage remove failed:', error);
    throw error;
  }
};
