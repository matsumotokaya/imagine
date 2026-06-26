import { getSupabaseStoragePublicUrl } from './supabase';

// Storage provider for an asset. New writes go to R2; legacy rows remain on
// Supabase until backfilled. `resolveAssetUrl` reads both transparently.
export type StorageProvider = 'supabase' | 'r2';

// Public R2 base URL (custom domain, e.g. https://assets.whatif-ep.xyz).
// Trailing slashes are stripped so callers can join with `/` safely.
const R2_PUBLIC_BASE_URL = (
  import.meta.env.VITE_R2_PUBLIC_BASE_URL as string | undefined
)?.replace(/\/+$/, '');

// When true, new uploads are routed to R2 (presigned PUT). When the env var is
// absent (e.g. local without R2), uploads fall back to Supabase Storage.
export const isR2Configured = Boolean(R2_PUBLIC_BASE_URL);

// Append a cache-busting `?v=` param while preserving any URL hash. Kept here
// (a leaf module) so both the URL resolver and storage helpers can share it
// without creating an import cycle.
export const appendCacheBust = (url: string, version?: string | null): string => {
  if (!version) return url;

  const [base, hash] = url.split('#', 2);
  const separator = base.includes('?') ? '&' : '?';
  const versionedUrl = `${base}${separator}v=${encodeURIComponent(version)}`;
  return hash ? `${versionedUrl}#${hash}` : versionedUrl;
};

const encodeKeySegments = (key: string): string =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

// Build the public R2 URL for an object key. The R2 object key layout mirrors
// the legacy Supabase layout prefixed with the logical bucket name:
//   user-images/{uid}/...        default-images/{file}.png
export const getR2PublicUrl = (r2Key: string, version?: string | null): string => {
  if (!R2_PUBLIC_BASE_URL) {
    throw new Error('VITE_R2_PUBLIC_BASE_URL is not configured');
  }
  const url = `${R2_PUBLIC_BASE_URL}/${encodeKeySegments(r2Key)}`;
  return appendCacheBust(url, version ?? undefined);
};

// Map a logical (bucket, key) pair to the R2 object key. For R2 the logical
// bucket name becomes the top-level key prefix so a single R2 bucket can hold
// what used to live in separate Supabase buckets.
export const toR2Key = (bucket: string, key: string): string => `${bucket}/${key}`;

// Provider-agnostic public URL resolver. Use this everywhere a stored asset is
// rendered so the same row works whether it lives on Supabase or R2.
export const resolveAssetUrl = (
  provider: StorageProvider,
  bucket: string,
  key: string,
  version?: string | null,
): string => {
  if (provider === 'r2') {
    return getR2PublicUrl(toR2Key(bucket, key), version);
  }
  return appendCacheBust(getSupabaseStoragePublicUrl(bucket, key), version ?? undefined);
};
