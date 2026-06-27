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

interface DeleteResponse {
  deleted?: string[];
  error?: string;
  results?: Array<{ key: string; ok: boolean; status: number }>;
}

// Delete one or more objects from R2 via the `r2-presign` Edge Function
// (op: 'delete'). The function verifies the caller's Supabase JWT and enforces
// the same per-key permission model as uploads before signing the DELETE, so
// R2 credentials never reach the client. `r2Keys` are full object keys
// including the logical bucket prefix (e.g. `user-images/{uid}/...`).
//
// This mirrors `removeFilesFromBucket(bucket, paths)`: a no-op on an empty
// list, idempotent (deleting a missing object succeeds), and throwing on
// failure so callers can treat success as "the objects are gone".
export const deleteFromR2 = async (r2Keys: string[]): Promise<void> => {
  const uniqueKeys = [...new Set(r2Keys.filter(Boolean))];
  if (uniqueKeys.length === 0) return;

  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke<DeleteResponse>('r2-presign', {
    body: { op: 'delete', keys: uniqueKeys },
  });

  if (error) {
    throw new Error(`R2 delete failed: ${error.message}`);
  }
  if (data?.error) {
    throw new Error(`R2 delete failed: ${data.error}`);
  }
};

// Convenience wrapper for deleting a single key. Mirrors `deleteFromR2` but
// reads more naturally at call sites that only have one object.
export const deleteFileFromR2 = async (r2Key: string): Promise<void> => {
  await deleteFromR2([r2Key]);
};
