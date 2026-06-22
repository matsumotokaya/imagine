-- Add thumbnail_path to default_images and user_images.
--
-- Library grids currently render full-size originals (avg 2.6-3.7MB, up to
-- 13.5MB) directly in <img>, which is very heavy. This column stores the
-- storage path of a lightweight JPEG thumbnail (max 400px, quality 0.7),
-- mirroring how banners use thumbnail_url. The value is a bucket-relative
-- path (same convention as storage_path), resolved to a public URL at read
-- time. NULL means no thumbnail yet (callers fall back to storage_path).
--
-- Storage RLS note: thumbnails live in the SAME buckets as the originals.
--   - default-images: INSERT/DELETE are admin-only and bucket-wide (no path
--     restriction), SELECT is public bucket-wide. Thumbnails under
--     "thumbnails/..." are already covered. No new policy required.
--   - user-images: all CRUD policies require (storage.foldername(name))[1] =
--     auth.uid(). Thumbnails are written under "<user_id>/thumbnails/..." so
--     the UID stays the first path segment. No new policy required.

alter table public.default_images
  add column if not exists thumbnail_path text;

alter table public.user_images
  add column if not exists thumbnail_path text;
