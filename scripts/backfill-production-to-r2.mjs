/**
 * Backfill existing Supabase Storage production outputs into Cloudflare R2.
 *
 * Phase 2 of the R2 migration (see docs/R2_MIGRATION.md):
 *   Pass A — copy production_outputs files (storage_provider='supabase') to R2
 *            at key `{logicalBucket}/{storage_path}`, then flip the row's
 *            storage_provider to 'r2'.
 *   Pass B — rewrite Gallery work_variants feed URLs that still point at the
 *            Supabase user-images public endpoint over to the R2 custom domain
 *            (only when the R2 object is confirmed present).
 *
 * The script is idempotent (already-migrated rows/files are skipped) and runs
 * in DRY-RUN by default. Files are copied first and verified before any DB
 * write, so a crash never leaves a row pointing at a missing object.
 *
 * Usage (dry-run):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
 *   R2_BUCKET=whatif-assets R2_PUBLIC_BASE_URL=https://assets.whatif-ep.xyz \
 *   node scripts/backfill-production-to-r2.mjs
 *
 * Add --apply to actually copy + write. Flags: --only-files, --only-variants.
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
const ONLY_FILES = process.argv.includes('--only-files');
const ONLY_VARIANTS = process.argv.includes('--only-variants');
// Destructive: delete the Supabase originals that are already migrated to R2.
// Runs ONLY this pass when set (skips copy/rewrite). Still dry-run unless --apply.
const DELETE_MIGRATED = process.argv.includes('--delete-migrated');

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

const SUPABASE_USER_IMAGES_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/user-images/`;
const R2_USER_IMAGES_PREFIX = `${R2_PUBLIC_BASE_URL}/user-images/`;

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

async function migrateProductionFiles() {
  console.log('\n=== Pass A: production_outputs files → R2 ===');
  const { data: rows, error } = await supabase
    .from('production_outputs')
    .select('id, storage_bucket, storage_path, mime_type, storage_provider')
    .eq('storage_provider', 'supabase');
  if (error) throw error;

  const valid = (rows || []).filter((r) => r.storage_bucket && r.storage_path);
  // Dedupe file copies by logical bucket + path (fixed filenames are reused).
  const byKey = new Map();
  for (const row of valid) {
    const r2Key = `${row.storage_bucket}/${row.storage_path}`;
    if (!byKey.has(r2Key)) byKey.set(r2Key, { ...row, r2Key, rowIds: [] });
    byKey.get(r2Key).rowIds.push(row.id);
  }

  console.log(
    `${valid.length} supabase rows / ${byKey.size} distinct files to ensure on R2`,
  );

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  const presentR2Keys = [];

  let i = 0;
  for (const entry of byKey.values()) {
    i += 1;
    const label = `[${i}/${byKey.size}] ${entry.r2Key}`;
    try {
      const head = await r2ObjectExists(entry.r2Key);
      if (head.exists) {
        skipped += 1;
        presentR2Keys.push(entry.r2Key);
        continue;
      }
      if (!APPLY) {
        console.log(`DRY would copy ${label}`);
        copied += 1; // counted as would-copy
        continue;
      }
      const { buffer, contentType } = await downloadFromSupabase(
        entry.storage_bucket,
        entry.storage_path,
      );
      await r2Put(entry.r2Key, buffer, entry.mime_type || contentType);
      const verify = await r2ObjectExists(entry.r2Key);
      if (!verify.exists) throw new Error('post-PUT HEAD missing');
      presentR2Keys.push(entry.r2Key);
      copied += 1;
      console.log(`copied ${label} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      failed += 1;
      console.warn(`FAILED ${label}: ${err.message}`);
    }
  }

  // Flip storage_provider on rows whose file is confirmed present on R2.
  const presentSet = new Set(presentR2Keys);
  const flipRowIds = [];
  for (const entry of byKey.values()) {
    if (presentSet.has(entry.r2Key)) flipRowIds.push(...entry.rowIds);
  }

  if (APPLY && flipRowIds.length) {
    // Chunked UPDATE to keep request sizes sane.
    const chunkSize = 200;
    for (let c = 0; c < flipRowIds.length; c += chunkSize) {
      const ids = flipRowIds.slice(c, c + chunkSize);
      const { error: upErr } = await supabase
        .from('production_outputs')
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
    `Pass A: copied=${copied} skipped(present)=${skipped} failed=${failed}`,
  );
}

async function rewriteVariantUrls() {
  console.log('\n=== Pass B: work_variants Supabase user-images URLs → R2 ===');
  const { data: variants, error } = await supabase
    .from('work_variants')
    .select('id, original_storage_key, thumbnail_storage_key');
  if (error) throw error;

  let rewritten = 0;
  let skippedMissing = 0;
  let unchanged = 0;

  for (const v of variants || []) {
    const updates = {};
    for (const field of ['original_storage_key', 'thumbnail_storage_key']) {
      const value = v[field];
      if (typeof value !== 'string' || !value.startsWith(SUPABASE_USER_IMAGES_PREFIX)) {
        continue;
      }
      const newUrl = value.replace(SUPABASE_USER_IMAGES_PREFIX, R2_USER_IMAGES_PREFIX);
      // Confirm the R2 object exists via the authenticated S3 endpoint (the
      // stored path is URL-encoded; decode before re-encoding in r2ObjectExists).
      const encodedPath = value.slice(SUPABASE_USER_IMAGES_PREFIX.length).split('?')[0];
      const decodedPath = encodedPath
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/');
      const r2Key = `user-images/${decodedPath}`;
      const head = await r2ObjectExists(r2Key);
      if (!head.exists) {
        skippedMissing += 1;
        continue;
      }
      updates[field] = newUrl;
    }
    if (Object.keys(updates).length === 0) {
      unchanged += 1;
      continue;
    }
    if (!APPLY) {
      console.log(`DRY would rewrite variant ${v.id}: ${Object.keys(updates).join(', ')}`);
      rewritten += 1;
      continue;
    }
    const { error: upErr } = await supabase
      .from('work_variants')
      .update(updates)
      .eq('id', v.id);
    if (upErr) throw upErr;
    rewritten += 1;
    console.log(`rewrote variant ${v.id}: ${Object.keys(updates).join(', ')}`);
  }

  console.log(
    `Pass B: rewritten=${rewritten} skipped(no R2 object)=${skippedMissing} unchanged=${unchanged}`,
  );
}

async function deleteMigratedSupabaseFiles() {
  console.log('\n=== DELETE: Supabase originals already on R2 ===');
  const { data: rows, error } = await supabase
    .from('production_outputs')
    .select('storage_bucket, storage_path')
    .eq('storage_provider', 'r2');
  if (error) throw error;

  // Distinct Supabase objects to consider deleting.
  const distinct = new Map();
  for (const row of rows || []) {
    if (!row.storage_bucket || !row.storage_path) continue;
    distinct.set(`${row.storage_bucket} ${row.storage_path}`, row);
  }

  const toDelete = new Map(); // bucket -> [paths]
  let kept = 0;
  let freedBytes = 0;
  let i = 0;
  for (const row of distinct.values()) {
    i += 1;
    const r2Key = `${row.storage_bucket}/${row.storage_path}`;
    // Safety: only delete the Supabase copy when the R2 object is confirmed.
    const head = await r2ObjectExists(r2Key);
    if (!head.exists) {
      kept += 1;
      console.warn(`KEEP (not on R2): ${r2Key}`);
      continue;
    }
    freedBytes += head.size;
    if (!toDelete.has(row.storage_bucket)) toDelete.set(row.storage_bucket, []);
    toDelete.get(row.storage_bucket).push(row.storage_path);
  }

  const totalToDelete = [...toDelete.values()].reduce((n, a) => n + a.length, 0);
  console.log(
    `candidates=${distinct.size} willDelete=${totalToDelete} kept(not on R2)=${kept} ~freed=${(
      freedBytes / 1048576
    ).toFixed(1)} MB`,
  );

  if (!APPLY) {
    console.log('DRY-RUN: no files deleted. Re-run with --apply --delete-migrated to delete.');
    return;
  }

  for (const [bucket, paths] of toDelete.entries()) {
    const chunkSize = 100;
    for (let c = 0; c < paths.length; c += chunkSize) {
      const batch = paths.slice(c, c + chunkSize);
      const { error: delErr } = await supabase.storage.from(bucket).remove(batch);
      if (delErr) throw delErr;
      console.log(`deleted ${batch.length} from ${bucket}`);
    }
  }
  console.log(`Deleted ${totalToDelete} Supabase objects.`);
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`);
  console.log(`R2 bucket: ${R2_BUCKET}  public: ${R2_PUBLIC_BASE_URL}`);

  if (DELETE_MIGRATED) {
    await deleteMigratedSupabaseFiles();
    console.log('\nDone.');
    return;
  }

  if (!ONLY_VARIANTS) await migrateProductionFiles();
  if (!ONLY_FILES) await rewriteVariantUrls();

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
