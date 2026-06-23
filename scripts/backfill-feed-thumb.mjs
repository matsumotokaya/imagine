/**
 * Backfill feed_thumb production_outputs for already-published projects.
 *
 * The Gallery list grid now prefers a lightweight credited feed thumbnail
 * (role='feed_thumb', ~720px long edge, WebP quality 0.82) served `unoptimized`
 * to bypass Vercel Image Optimization. New publishes emit this automatically
 * (see src/utils/productionOutputBuilder.ts). This one-off script generates the
 * same output for older published projects that have a ready instagram_feed but
 * no feed_thumb yet.
 *
 * It is idempotent: projects that already have a feed_thumb row are skipped.
 *
 * REQUIREMENTS:
 *   - Run AFTER applying migration
 *     20260623_add_feed_thumb_production_output_role.sql, otherwise the
 *     production_outputs role CHECK constraint rejects the feed_thumb insert.
 *   - Requires the SERVICE-ROLE key (bypasses RLS for storage upload + insert).
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-feed-thumb.mjs
 *
 * The generated thumbnail spec matches the in-app builder:
 *   - long edge 720px (a 1080x1350 feed becomes 576x720)
 *   - WebP, quality 0.82 (sharp quality is 0-100, so 82)
 *   - uploaded to the SAME path scheme used at publish time:
 *       user-images/<userId>/production/<projectId>/feed-thumb.webp  (upsert)
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error(
    'Usage: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-feed-thumb.mjs'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const OUTPUT_BUCKET = 'user-images';
const FEED_THUMB_LONG_EDGE = 720;
const FEED_THUMB_QUALITY = 82; // matches in-app 0.82
const FEED_THUMB_FILE_NAME = 'feed-thumb.webp';
const FEED_THUMB_MIME = 'image/webp';

// Build the feed_thumb storage path from the instagram_feed source path.
// instagram_feed lives at: <userId>/production/<projectId>/instagram-feed.png
// so the userId/projectId can be derived from its first/third segments. We
// fall back to projectId from the DB to stay robust if the path shape changes.
const buildFeedThumbPath = (feedStoragePath, projectId) => {
  const segments = feedStoragePath.split('/');
  const userId = segments[0];
  if (!userId) {
    throw new Error(`Cannot derive userId from feed path: ${feedStoragePath}`);
  }
  return `${userId}/production/${projectId}/${FEED_THUMB_FILE_NAME}`;
};

const main = async () => {
  console.log('=== feed_thumb Backfill ===');
  console.log(
    `Target: WebP ${FEED_THUMB_LONG_EDGE}px long edge, quality ${FEED_THUMB_QUALITY}`
  );

  // Published projects only.
  const { data: projectsData, error: projectsError } = await supabase
    .from('production_projects')
    .select('id')
    .eq('status', 'published');

  if (projectsError) {
    throw projectsError;
  }

  const projectIds = (projectsData || []).map((p) => p.id);
  console.log(`Published projects: ${projectIds.length}`);
  if (projectIds.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  // Ready instagram_feed outputs for those projects.
  const { data: feedOutputs, error: feedError } = await supabase
    .from('production_outputs')
    .select('id, project_id, source_banner_id, storage_bucket, storage_path')
    .in('project_id', projectIds)
    .eq('role', 'instagram_feed')
    .eq('status', 'ready');

  if (feedError) {
    throw feedError;
  }

  // Existing feed_thumb rows so we can skip projects that already have one.
  const { data: thumbOutputs, error: thumbError } = await supabase
    .from('production_outputs')
    .select('project_id')
    .in('project_id', projectIds)
    .eq('role', 'feed_thumb');

  if (thumbError) {
    throw thumbError;
  }

  const projectsWithThumb = new Set((thumbOutputs || []).map((r) => r.project_id));

  const targets = (feedOutputs || []).filter(
    (row) =>
      row.storage_path &&
      (row.storage_bucket ?? OUTPUT_BUCKET) === OUTPUT_BUCKET &&
      !projectsWithThumb.has(row.project_id)
  );

  console.log(`instagram_feed outputs found: ${(feedOutputs || []).length}`);
  console.log(`Already have feed_thumb: ${projectsWithThumb.size}`);
  console.log(`Projects to backfill: ${targets.length}`);

  let done = 0;
  let failed = 0;

  for (const row of targets) {
    try {
      // Download the credited instagram_feed image.
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(OUTPUT_BUCKET)
        .download(row.storage_path);

      if (downloadError) {
        throw downloadError;
      }

      const originalBuffer = Buffer.from(await fileData.arrayBuffer());

      // Downscale to 720px long edge, WebP quality 82. Aspect ratio preserved;
      // the credit is already baked into the feed pixels so it survives.
      const sharpImage = sharp(originalBuffer);
      const thumbnailBuffer = await sharpImage
        .clone()
        .resize(FEED_THUMB_LONG_EDGE, FEED_THUMB_LONG_EDGE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: FEED_THUMB_QUALITY })
        .toBuffer();

      const meta = await sharp(thumbnailBuffer).metadata();
      const width = meta.width ?? null;
      const height = meta.height ?? null;

      const thumbPath = buildFeedThumbPath(row.storage_path, row.project_id);

      const { error: uploadError } = await supabase.storage
        .from(OUTPUT_BUCKET)
        .upload(thumbPath, thumbnailBuffer, {
          contentType: FEED_THUMB_MIME,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: insertError } = await supabase
        .from('production_outputs')
        .insert({
          project_id: row.project_id,
          source_banner_id: row.source_banner_id ?? null,
          role: 'feed_thumb',
          storage_provider: 'supabase',
          storage_bucket: OUTPUT_BUCKET,
          storage_path: thumbPath,
          mime_type: FEED_THUMB_MIME,
          file_size_bytes: thumbnailBuffer.length,
          width,
          height,
          status: 'ready',
          is_current: true,
        });

      if (insertError) {
        throw insertError;
      }

      console.log(
        `  OK  project ${row.project_id} -> ${thumbPath} ` +
          `(${Math.round(originalBuffer.length / 1024)}KB -> ` +
          `${Math.round(thumbnailBuffer.length / 1024)}KB, ${width}x${height})`
      );
      done += 1;
    } catch (err) {
      console.log(`  FAIL project ${row.project_id} (${row.storage_path}): ${err.message}`);
      failed += 1;
    }
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Backfilled: ${done}, Failed: ${failed}, Skipped (already had feed_thumb): ${projectsWithThumb.size}`);
};

main().catch((error) => {
  console.error('feed_thumb backfill failed:', error);
  process.exit(1);
});
