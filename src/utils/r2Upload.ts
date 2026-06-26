import { getSupabase } from './supabase';
import { getR2PublicUrl } from './assetUrl';

interface PresignResponse {
  url: string;
}

// Request a presigned PUT URL from the `r2-presign` Edge Function. The function
// verifies the caller's Supabase JWT (attached automatically by functions.invoke)
// and enforces that the key is writable by this user before signing.
const requestPresignedPutUrl = async (
  r2Key: string,
  contentType: string,
): Promise<string> => {
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke<PresignResponse>('r2-presign', {
    body: { key: r2Key, contentType },
  });

  if (error) {
    throw new Error(`Failed to get R2 presigned URL: ${error.message}`);
  }
  if (!data?.url) {
    throw new Error('R2 presign returned no URL');
  }
  return data.url;
};

// Upload a blob to R2 via a presigned PUT, then return its public URL.
// `r2Key` is the full object key including the logical bucket prefix
// (e.g. `user-images/{uid}/...` or `default-images/{file}.png`).
export const uploadBlobToR2 = async (
  r2Key: string,
  blob: Blob,
  contentType: string,
): Promise<string> => {
  const presignedUrl = await requestPresignedPutUrl(r2Key, contentType);

  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 upload failed (${response.status}): ${detail}`);
  }

  return getR2PublicUrl(r2Key);
};
