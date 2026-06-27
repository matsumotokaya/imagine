/**
 * Backfill existing Supabase Storage default-images into Cloudflare R2.
 *
 * Phase 2 / Wave A of the R2 migration (see docs/R2_MIGRATION.md):
 *   Copy default_images rows (storage_provider='supabase') from the Supabase
 *   `default-images` bucket to R2 at key `default-images/{path}` for both the
 *   original (storage_path) and, when present, the thumbnail (thumbnail_path).
 *   Then flip the row's storage_provider to 'r2'.
 *
 * The script is idempotent (already-migrated rows and files already on R2 are
 * skipped) and runs in DRY-RUN by default. Files are copied and verified before
 * any DB write, so a crash never leaves a row pointing at a missing object
 * (file first, DB after).
 *
 * Usage (dry-run):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
 *   R2_BUCKET=whatif-assets R2_PUBLIC_BASE_URL=https://assets.whatif-ep.xyz \
 *   node scripts/backfill-default-images-to-r2.mjs
 *
 * Add --apply to actually copy + write.
 * Add --delete-migrated to delete Supabase originals already on R2 (still
 * dry-run unless --apply). When set, runs ONLY the delete pass.
 */

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'whatif-assets';
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

const APPLY = process.argv.includes('--apply');
// Destructive: delete the Supabase originals that are already migrated to R2.
// Runs ONLY this pass when set (skips copy). Still dry-run unless --apply.
const DELETE_MIGRATED = process.argv.includes('--delete-migrated');

// Logical bucket holding default-images. Fixed (the table stores bucket-relative
// paths in storage_path / thumbnail_path).
const DEFAULT_IMAGES_BUCKET = 'default-images';

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
if (!R2_PUBLIC_BASE_URL) missing.push('R2_PUBLIC_BASE_URL');
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
});

const encodeKey = (key) =>
  key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

// Existence/verify against the R2 S3 API endpoint (authenticated). The public
// custom domain (assets.whatif-ep.xyz) sits behind Cloudflare, which negative-
// caches the 404 from a pre-upload HEAD and then serves that stale 404 right
// after the PUT — causing false "missing" verifications. The S3 API endpoint
// has no CDN cache and is read-after-write consistent.
const r2ObjectExists = async (r2Key) => {
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeKey(r2Key)}`;
  const res = await r2.fetch(url, { method: 'HEAD' });
  if (res.ok) {
    return { exists: true, size: Number(res.headers.get('content-length') || 0) };
  }
  return { exists: false, size: 0 };
};

const r2Put = async (r2Key, body, contentType) => {
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeKey(r2Key)}`;
  const res = await r2.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`R2 PUT ${res.status}: ${detail}`);
  }
};

const downloadFromSupabase = async (bucket, path) => {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, contentType: data.type || 'application/octet-stream' };
};

// Ensure a single Supabase object is present on R2 (copy if missing, verify).
// Returns true when the object is confirmed on R2 afterwards. In dry-run it
// reports the intent and returns false (so rows are not flipped without --apply).
const ensureFileOnR2 = async (storagePath, label, counters) => {
  const r2Key = `${DEFAULT_IMAGES_BUCKET}/${storagePath}`;
  const head = await r2ObjectExists(r2Key);
  if (head.exists) {
    counters.skipped += 1;
    return true;
  }
  if (!APPLY) {
    console.log(`DRY would copy ${label}`);
    counters.wouldCopy += 1;
    return false;
  }
  const { buffer, contentType } = await downloadFromSupabase(DEFAULT_IMAGES_BUCKET, storagePath);
  await r2Put(r2Key, buffer, contentType);
  const verify = await r2ObjectExists(r2Key);
  if (!verify.exists) throw new Error('post-PUT HEAD missing');
  counters.copied += 1;
  console.log(`copied ${label} (${(buffer.length / 1024).toFixed(0)} KB)`);
  return true;
};

async function migrateDefaultImages() {
  console.log('\n=== default_images files → R2 ===');
  const { data: rows, error } = await supabase
    .from('default_images')
    .select('id, storage_path, thumbnail_path, storage_provider')
    .eq('storage_provider', 'supabase');
  if (error) throw error;

  const valid = (rows || []).filter((r) => r.storage_path);
  console.log(`${valid.length} supabase rows to ensure on R2`);

  const counters = { copied: 0, skipped: 0, wouldCopy: 0 };
  let failed = 0;
  const flipRowIds = [];

  let i = 0;
  for (const row of valid) {
    i += 1;
    const prefix = `[${i}/${valid.length}]`;
    try {
      // The row is migrated only when ALL of its objects (original + thumbnail
      // when present) are confirmed on R2.
      const okOriginal = await ensureFileOnR2(
        row.storage_path,
        `${prefix} ${DEFAULT_IMAGES_BUCKET}/${row.storage_path}`,
        counters,
      );

      let okThumb = true;
      if (row.thumbnail_path) {
        okThumb = await ensureFileOnR2(
          row.thumbnail_path,
          `${prefix} ${DEFAULT_IMAGES_BUCKET}/${row.thumbnail_path}`,
          counters,
        );
      }

      if (okOriginal && okThumb) flipRowIds.push(row.id);
    } catch (err) {
      failed += 1;
      console.warn(`FAILED ${prefix} ${row.id}: ${err.message}`);
    }
  }

  if (APPLY && flipRowIds.length) {
    // Chunked UPDATE to keep request sizes sane.
    const chunkSize = 200;
    for (let c = 0; c < flipRowIds.length; c += chunkSize) {
      const ids = flipRowIds.slice(c, c + chunkSize);
      const { error: upErr } = await supabase
        .from('default_images')
        .update({ storage_provider: 'r2' })
        .in('id', ids);
      if (upErr) throw upErr;
    }
    console.log(`flipped storage_provider='r2' on ${flipRowIds.length} rows`);
  } else {
    console.log(
      `DRY would flip storage_provider on ${flipRowIds.length} rows (files present on R2)`,
    );
  }

  console.log(
    `Done: copied=${counters.copied} skipped(present)=${counters.skipped} wouldCopy=${counters.wouldCopy} failed=${failed}`,
  );
}

async function deleteMigratedSupabaseFiles() {
  console.log('\n=== DELETE: Supabase default-images originals already on R2 ===');
  const { data: rows, error } = await supabase
    .from('default_images')
    .select('storage_path, thumbnail_path')
    .eq('storage_provider', 'r2');
  if (error) throw error;

  // Distinct Supabase object paths to consider deleting (original + thumbnail).
  const distinct = new Set();
  for (const row of rows || []) {
    if (row.storage_path) distinct.add(row.storage_path);
    if (row.thumbnail_path) distinct.add(row.thumbnail_path);
  }

  const toDelete = [];
  let kept = 0;
  let freedBytes = 0;
  let i = 0;
  for (const path of distinct.values()) {
    i += 1;
    const r2Key = `${DEFAULT_IMAGES_BUCKET}/${path}`;
    // Safety: only delete the Supabase copy when the R2 object is confirmed.
    const head = await r2ObjectExists(r2Key);
    if (!head.exists) {
      kept += 1;
      console.warn(`KEEP (not on R2): ${r2Key}`);
      continue;
    }
    freedBytes += head.size;
    toDelete.push(path);
  }

  console.log(
    `candidates=${distinct.size} willDelete=${toDelete.length} kept(not on R2)=${kept} ~freed=${(
      freedBytes / 1048576
    ).toFixed(1)} MB`,
  );

  if (!APPLY) {
    console.log('DRY-RUN: no files deleted. Re-run with --apply --delete-migrated to delete.');
    return;
  }

  const chunkSize = 100;
  for (let c = 0; c < toDelete.length; c += chunkSize) {
    const batch = toDelete.slice(c, c + chunkSize);
    const { error: delErr } = await supabase.storage.from(DEFAULT_IMAGES_BUCKET).remove(batch);
    if (delErr) throw delErr;
    console.log(`deleted ${batch.length} from ${DEFAULT_IMAGES_BUCKET}`);
  }
  console.log(`Deleted ${toDelete.length} Supabase objects.`);
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`);
  console.log(`R2 bucket: ${R2_BUCKET}  public: ${R2_PUBLIC_BASE_URL}`);

  if (DELETE_MIGRATED) {
    await deleteMigratedSupabaseFiles();
    console.log('\nDone.');
    return;
  }

  await migrateDefaultImages();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
