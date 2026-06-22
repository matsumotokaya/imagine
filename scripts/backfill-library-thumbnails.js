/**
 * Backfill thumbnail_path for default_images and user_images.
 *
 * Library grids render full-size originals (avg 2.6-3.7MB, up to 13.5MB).
 * This script generates a JPEG thumbnail (max 400px longest edge, quality 70)
 * for every row that has no thumbnail_path yet, uploads it to the SAME bucket
 * under a thumbnails/ path, and records the path in thumbnail_path.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-library-thumbnails.js
 *
 * Run AFTER applying migration 20260622_add_thumbnail_path_to_image_libraries.sql.
 *
 * Storage path conventions (must match the app + storage RLS):
 *   - default-images: thumbnails/<original-path-with-slashes-flattened>.jpg
 *     (bucket is admin/bucket-wide, any path works)
 *   - user-images:    <user_id>/thumbnails/<rest-of-path-flattened>.jpg
 *     (RLS requires the first path segment to equal the owner user_id)
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error(
    'Usage: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-library-thumbnails.js'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const THUMBNAIL_MAX_DIMENSION = 400;
const JPEG_QUALITY = 70;

// Build the thumbnail storage path for a given bucket + original path.
const buildThumbnailPath = (bucket, storagePath) => {
  if (bucket === 'user-images') {
    // Keep the owner UID as the first segment (RLS requirement).
    const segments = storagePath.split('/');
    const userId = segments[0];
    const rest = segments.slice(1).join('__') || 'asset';
    return `${userId}/thumbnails/${rest}.jpg`;
  }
  // default-images: flatten the whole original path under thumbnails/.
  const flattened = storagePath.split('/').join('__');
  return `thumbnails/${flattened}.jpg`;
};

const processTable = async (table, bucket) => {
  console.log(`\n=== ${table} (${bucket}) ===`);

  const { data: rows, error } = await supabase
    .from(table)
    .select('id, storage_path, thumbnail_path')
    .is('thumbnail_path', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const targets = (rows || []).filter((row) => row.storage_path);
  console.log(`Rows needing a thumbnail: ${targets.length}`);

  let done = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of targets) {
    try {
      // Download the original from storage.
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(row.storage_path);

      if (downloadError) {
        throw downloadError;
      }

      const originalBuffer = Buffer.from(await fileData.arrayBuffer());

      // Resize to max 400px on the longest edge, encode as JPEG quality 70.
      const thumbnailBuffer = await sharp(originalBuffer)
        .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

      const thumbnailPath = buildThumbnailPath(bucket, row.storage_path);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(thumbnailPath, thumbnailBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await supabase
        .from(table)
        .update({ thumbnail_path: thumbnailPath })
        .eq('id', row.id);

      if (updateError) {
        throw updateError;
      }

      console.log(
        `  OK  ${row.id} -> ${thumbnailPath} (${Math.round(originalBuffer.length / 1024)}KB -> ${Math.round(
          thumbnailBuffer.length / 1024
        )}KB)`
      );
      done += 1;
    } catch (err) {
      console.log(`  FAIL ${row.id} (${row.storage_path}): ${err.message}`);
      failed += 1;
    }
  }

  console.log(`Done: ${done}, Failed: ${failed}, Skipped: ${skipped}`);
  return { done, failed };
};

const main = async () => {
  console.log('=== Library Thumbnail Backfill ===');
  console.log(`Target: JPEG ${THUMBNAIL_MAX_DIMENSION}px longest edge, quality ${JPEG_QUALITY}`);

  const defaultResult = await processTable('default_images', 'default-images');
  const userResult = await processTable('user_images', 'user-images');

  console.log('\n=== Backfill Complete ===');
  console.log(`default_images: ${defaultResult.done} done, ${defaultResult.failed} failed`);
  console.log(`user_images:    ${userResult.done} done, ${userResult.failed} failed`);
};

main().catch((error) => {
  console.error('Library thumbnail backfill failed:', error);
  process.exit(1);
});
