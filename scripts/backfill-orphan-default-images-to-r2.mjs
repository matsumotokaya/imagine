/**
 * Copy "orphan" default-images files (referenced by banners/templates
 * elements[].src but with NO row in the default_images table) from Supabase to
 * R2, then rewrite the baked JSONB URLs to R2.
 *
 * Why: Wave A only migrated table-tracked default_images. These orphans still
 * live only in the Supabase default-images bucket, so they work today but will
 * break the moment the orphan storage cleanup deletes them (same failure mode as
 * the 0443 incident). This removes that time bomb by putting them on R2 first.
 *
 * Safety:
 *   - Files first, DB after: a path is only rewritten once confirmed on R2 via
 *     an authenticated S3 HEAD (the public CDN negative-caches 404s).
 *   - Writes a JSON backup of affected rows (id + elements) before any rewrite.
 *   - DRY-RUN by default. Add --apply to copy + write.
 *   - --restore <file> --apply restores elements from a backup.
 *
 * Env (imagine/.env.r2backfill.local):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL
 */

import { createClient } from '@supabase/supabase-js';
import { AwsClient } from 'aws4fetch';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'whatif-assets';
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const RESTORE_FILE = restoreIdx >= 0 ? process.argv[restoreIdx + 1] : null;

const DEFAULT_IMAGES_BUCKET = 'default-images';
const TABLES = ['banners', 'templates'];
const MARKER = '/storage/v1/object/public/default-images/';
const PATH_RE = /\/storage\/v1\/object\/public\/default-images\/(.+)$/;
const BACKUP_DIR = join(__dirname, 'backups');

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!RESTORE_FILE) {
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (!R2_PUBLIC_BASE_URL) missing.push('R2_PUBLIC_BASE_URL');
}
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

const r2ObjectExists = async (r2Key) => {
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeKey(r2Key)}`;
  const res = await r2.fetch(url, { method: 'HEAD' });
  return res.ok;
};
const r2Put = async (r2Key, body, contentType) => {
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${encodeKey(r2Key)}`;
  const res = await r2.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body,
  });
  if (!res.ok) throw new Error(`R2 PUT ${res.status}: ${await res.text().catch(() => '')}`);
};
const downloadFromSupabase = async (path) => {
  const { data, error } = await supabase.storage.from(DEFAULT_IMAGES_BUCKET).download(path);
  if (error) throw error;
  return { buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || 'application/octet-stream' };
};

async function fetchAll(table, columns) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

function extractPath(src) {
  const m = src.match(PATH_RE);
  if (!m) return null;
  const tail = m[1];
  const q = tail.indexOf('?');
  return q >= 0 ? tail.slice(0, q) : tail;
}

async function runRestore() {
  console.log(`[restore] reading ${RESTORE_FILE}`);
  const backup = JSON.parse(readFileSync(RESTORE_FILE, 'utf8'));
  for (const table of TABLES) {
    const rows = backup[table] || [];
    console.log(`[restore] ${table}: ${rows.length} rows`);
    if (!APPLY) continue;
    for (const r of rows) {
      const { error } = await supabase.from(table).update({ elements: r.elements }).eq('id', r.id);
      if (error) throw new Error(`restore ${table} ${r.id} failed: ${error.message}`);
    }
  }
  console.log(APPLY ? '[restore] done' : '[restore] DRY-RUN (add --apply)');
}

async function run() {
  if (RESTORE_FILE) return runRestore();

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  // 1) default_images paths (table-tracked, any provider) — NOT orphans.
  const diRows = await fetchAll('default_images', 'storage_path');
  const tracked = new Set(diRows.map((r) => r.storage_path).filter(Boolean));

  // 2) Collect rows + orphan candidate paths referenced in elements.
  const rowsByTable = {};
  const candidatePaths = new Set();
  for (const table of TABLES) {
    const all = await fetchAll(table, 'id, elements');
    const hit = all.filter((r) => JSON.stringify(r.elements ?? null).includes(MARKER));
    rowsByTable[table] = hit;
    for (const r of hit) {
      if (!Array.isArray(r.elements)) continue;
      for (const el of r.elements) {
        if (el && typeof el.src === 'string' && el.src.includes(MARKER)) {
          const p = extractPath(el.src);
          if (p && !tracked.has(p)) candidatePaths.add(p);
        }
      }
    }
  }
  console.log(`Orphan candidate paths (referenced, not in default_images): ${candidatePaths.size}`);

  // 3) Ensure each candidate is on R2 (copy if missing). Confirmed set drives rewrite.
  const confirmed = new Set();
  const failed = [];
  for (const path of candidatePaths) {
    const r2Key = `${DEFAULT_IMAGES_BUCKET}/${path}`;
    try {
      if (await r2ObjectExists(r2Key)) {
        confirmed.add(path);
        console.log(`on R2 already: ${path}`);
        continue;
      }
      if (!APPLY) {
        console.log(`DRY would copy: ${path}`);
        confirmed.add(path); // eligible for rewrite reporting
        continue;
      }
      const { buffer, contentType } = await downloadFromSupabase(path);
      await r2Put(r2Key, buffer, contentType);
      if (!(await r2ObjectExists(r2Key))) throw new Error('post-PUT HEAD missing');
      confirmed.add(path);
      console.log(`copied: ${path} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      failed.push({ path, error: String(e.message || e) });
      console.warn(`FAILED ${path}: ${e.message || e}`);
    }
  }

  // 4) Backup, then rewrite refs whose path is confirmed on R2.
  const backup = {};
  for (const table of TABLES) backup[table] = rowsByTable[table].map((r) => ({ id: r.id, elements: r.elements }));
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `orphan-defimg-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath}`);

  let totalRows = 0;
  let totalRefs = 0;
  for (const table of TABLES) {
    let rows = 0;
    let refs = 0;
    for (const r of rowsByTable[table]) {
      if (!Array.isArray(r.elements)) continue;
      let changed = false;
      const next = r.elements.map((el) => {
        if (!el || typeof el.src !== 'string' || !el.src.includes(MARKER)) return el;
        const p = extractPath(el.src);
        if (!p || !confirmed.has(p)) return el;
        const q = el.src.indexOf('?');
        const query = q >= 0 ? el.src.slice(q) : '';
        changed = true;
        refs += 1;
        return { ...el, src: `${R2_PUBLIC_BASE_URL}/${DEFAULT_IMAGES_BUCKET}/${p}${query}` };
      });
      if (!changed) continue;
      rows += 1;
      if (APPLY) {
        const { error } = await supabase.from(table).update({ elements: next }).eq('id', r.id);
        if (error) throw new Error(`update ${table} ${r.id} failed: ${error.message}`);
      }
    }
    totalRows += rows;
    totalRefs += refs;
    console.log(`${table}: rows changed=${rows}, refs rewritten=${refs}`);
  }

  console.log('---');
  console.log(`Confirmed on R2: ${confirmed.size} paths, FAILED: ${failed.length}`);
  console.log(`TOTAL rows changed: ${totalRows}, refs rewritten: ${totalRefs}`);
  if (failed.length) console.log('Failed paths:', failed);
  console.log(APPLY ? 'APPLIED.' : 'DRY-RUN only. Re-run with --apply to copy + write.');
  console.log(`Restore: node scripts/backfill-orphan-default-images-to-r2.mjs --restore ${backupPath} --apply`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
