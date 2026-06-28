/**
 * Mirror ALL remaining Supabase `default-images` bucket objects to R2, then
 * (optionally) delete the Supabase copies to reclaim storage.
 *
 * Context: the browsable library (default_images table, 112 rows) is already
 * 100% on R2. What remains in the Supabase bucket are untracked leftovers
 * (per-template upload images under templates/, plus a few root files) that have
 * NO default_images row and are referenced by no banner/template after the
 * earlier JSONB fixes. The user approved removing them, but losslessly: copy to
 * R2 first so nothing is ever lost.
 *
 * Safety:
 *   - Files first: an object is only deleted from Supabase after it is confirmed
 *     present on R2 via an authenticated S3 HEAD (public CDN negative-caches).
 *   - Defensive: never deletes an object whose name matches a default_images
 *     storage_path / thumbnail_path (the tracked library), even though none
 *     should remain.
 *   - DRY-RUN by default. --apply copies. Add --delete to also delete from
 *     Supabase (still requires --apply to actually act).
 *
 * Env (imagine/.env.r2backfill.local):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
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

const APPLY = process.argv.includes('--apply');
const DELETE = process.argv.includes('--delete');

const BUCKET = 'default-images';

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
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

const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');
// R2 keys are prefixed with the logical bucket name, matching the public URL
// assets.whatif-ep.xyz/default-images/{path} and the other backfill scripts.
const r2KeyFor = (name) => `${BUCKET}/${name}`;
const r2Url = (key) => `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeKey(key)}`;

const r2Exists = async (key) => (await r2.fetch(r2Url(key), { method: 'HEAD' })).ok;
const r2Put = async (key, body, contentType) => {
  const res = await r2.fetch(r2Url(key), {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body,
  });
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${await res.text().catch(() => '')}`);
};

// Recursively list every object in the bucket. Folders come back with id=null.
async function listAll(prefix = '') {
  const out = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list ${prefix} failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        out.push(...(await listAll(full))); // folder
      } else {
        out.push({ name: full, size: entry.metadata?.size ?? 0, mime: entry.metadata?.mimetype });
      }
    }
    if (data.length < pageSize) break;
  }
  return out;
}

async function trackedPaths() {
  const set = new Set();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('default_images')
      .select('storage_path, thumbnail_path')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`default_images fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) {
      if (r.storage_path) set.add(r.storage_path);
      if (r.thumbnail_path) set.add(r.thumbnail_path);
    }
    if (data.length < pageSize) break;
  }
  return set;
}

async function run() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}${DELETE ? ' +DELETE' : ''}`);

  const tracked = await trackedPaths();
  const objects = await listAll('');
  console.log(`Bucket objects: ${objects.length} | tracked library paths: ${tracked.size}`);

  let copied = 0;
  let already = 0;
  let skippedTracked = 0;
  const confirmed = [];
  const failed = [];

  for (const obj of objects) {
    if (tracked.has(obj.name)) {
      skippedTracked += 1; // defensive: never touch the live library
      continue;
    }
    const r2Key = r2KeyFor(obj.name);
    try {
      if (await r2Exists(r2Key)) {
        already += 1;
        confirmed.push(obj.name);
        continue;
      }
      if (!APPLY) {
        console.log(`DRY would copy: ${obj.name} (${(obj.size / 1024).toFixed(0)} KB)`);
        confirmed.push(obj.name);
        continue;
      }
      const { data, error } = await supabase.storage.from(BUCKET).download(obj.name);
      if (error) throw error;
      const buf = Buffer.from(await data.arrayBuffer());
      await r2Put(r2Key, buf, data.type || obj.mime);
      if (!(await r2Exists(r2Key))) throw new Error('post-PUT HEAD missing');
      copied += 1;
      confirmed.push(obj.name);
      console.log(`copied: ${obj.name} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      failed.push({ name: obj.name, error: String(e.message || e) });
      console.warn(`FAILED ${obj.name}: ${e.message || e}`);
    }
  }

  console.log('---');
  console.log(`copied=${copied}, already_on_r2=${already}, skipped_tracked=${skippedTracked}, failed=${failed.length}`);
  console.log(`confirmed on R2 (deletable): ${confirmed.length}`);

  if (DELETE) {
    if (!APPLY) {
      console.log(`DRY would delete ${confirmed.length} Supabase objects (after R2 confirm).`);
    } else {
      // Delete in batches; only objects confirmed present on R2 above.
      const batchSize = 100;
      let deleted = 0;
      for (let i = 0; i < confirmed.length; i += batchSize) {
        const batch = confirmed.slice(i, i + batchSize);
        const { error } = await supabase.storage.from(BUCKET).remove(batch);
        if (error) throw new Error(`delete batch failed: ${error.message}`);
        deleted += batch.length;
      }
      console.log(`deleted from Supabase: ${deleted}`);
    }
  }

  if (failed.length) console.log('Failed:', failed);
  console.log(APPLY ? 'APPLIED.' : 'DRY-RUN only. Add --apply (and --delete to remove from Supabase).');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
