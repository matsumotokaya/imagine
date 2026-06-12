import { getSupabase, getSupabaseStoragePublicUrl } from './supabase';

const DATA_URL_PREFIX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/;

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
  contentType: string
): Promise<string> => {
  const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, { contentType, upsert: false });

  if (error) {
    console.error('Storage upload failed:', error);
    throw error;
  }

  return getSupabaseStoragePublicUrl(bucket, filePath);
};

export const uploadDataUrlToBucket = async (
  dataUrl: string,
  bucket: string,
  filePathBase: string
): Promise<string> => {
  const { blob, mimeType, extension } = dataUrlToBlob(dataUrl);
  const filePath = `${filePathBase}.${extension}`;
  return uploadBlobToBucket(bucket, filePath, blob, mimeType);
};

export const uploadFileToBucket = async (
  file: File,
  bucket: string,
  filePathBase: string
): Promise<string> => {
  const extension = getExtensionFromMime(file.type || '');
  const filePath = `${filePathBase}.${extension}`;
  const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error('Storage upload failed:', error);
    throw error;
  }

  return getSupabaseStoragePublicUrl(bucket, filePath);
};
