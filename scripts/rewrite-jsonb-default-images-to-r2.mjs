/**
 * Rewrite baked Supabase `default-images` URLs in banners/templates `elements`
 * JSONB to their Cloudflare R2 equivalents.
 *
 * Why: Wave A of the R2 migration copied default_images to R2 and DELETED the
 * Supabase originals, but the absolute URLs baked into banners/templates
 * `elements[].src` were never rewritten. Those URLs now 404, so images render
 * as an empty bounding box. This script fixes the data (see docs/R2_MIGRATION.md).
 *
 * Safety model:
 *   - Always writes a full JSON backup of every affected row BEFORE any change.
 *   - Only rewrites a src whose default-images path is confirmed present in
 *     `default_images` with storage_provider='r2' (the "on_r2" set). Paths that
 *     are Supabase-only orphans (still alive) or missing everywhere are left
 *     untouched, so nothing that currently works is broken.
 *   - Preserves any query string (e.g. ?v=...).
 *   - DRY-RUN by default. Add --apply to write.
 *   - --restore <backupFile> restores `elements` from a backup file.
 *
 * Usage:
 *   node scripts/rewrite-jsonb-default-images-to-r2.mjs            # dry-run + backup
 *   node scripts/rewrite-jsonb-default-images-to-r2.mjs --apply    # backup + write
 *   node scripts/rewrite-jsonb-default-images-to-r2.mjs --restore scripts/backups/<file>.json --apply
 *
 * Env (from imagine/.env.r2backfill.local):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, R2_PUBLIC_BASE_URL
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const R2_PUBLIC_BASE_URL = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');

const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const RESTORE_FILE = restoreIdx >= 0 ? process.argv[restoreIdx + 1] : null;

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!RESTORE_FILE && !R2_PUBLIC_BASE_URL) missing.push('R2_PUBLIC_BASE_URL');
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLES = ['banners', 'templates'];
const MARKER = '/storage/v1/object/public/default-images/';
const PATH_RE = /\/storage\/v1\/object\/public\/default-images\/(.+)$/;
const BACKUP_DIR = join(__dirname, 'backups');

// Page through a table pulling id + elements only.
async function fetchAll(table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('id, elements')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows;
}

// Load the set of default-images paths that are confirmed live on R2.
async function fetchOnR2Paths() {
  const set = new Set();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('default_images')
      .select('storage_path, storage_provider')
      .eq('storage_provider', 'r2')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`default_images fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) if (r.storage_path) set.add(r.storage_path);
    if (data.length < pageSize) break;
  }
  return set;
}

function rowHasMarker(row) {
  return JSON.stringify(row.elements ?? null).includes(MARKER);
}

// Returns { changed: boolean, elements: newElements, stats: {...} } for a row.
function rewriteElements(elements, onR2) {
  const stats = { rewritten: 0, orphanLeft: 0, missingLeft: 0 };
  if (!Array.isArray(elements)) return { changed: false, elements, stats };
  let changed = false;
  const next = elements.map((el) => {
    const src = el && typeof el.src === 'string' ? el.src : null;
    if (!src || !src.includes(MARKER)) return el;
    const m = src.match(PATH_RE);
    if (!m) return el;
    const rawTail = m[1]; // path + optional ?query
    const qIdx = rawTail.indexOf('?');
    const path = qIdx >= 0 ? rawTail.slice(0, qIdx) : rawTail;
    const query = qIdx >= 0 ? rawTail.slice(qIdx) : '';
    if (!onR2.has(path)) {
      stats.missingLeft += 1; // counted loosely; orphan vs missing not split here
      return el;
    }
    stats.rewritten += 1;
    changed = true;
    return { ...el, src: `${R2_PUBLIC_BASE_URL}/default-images/${path}${query}` };
  });
  return { changed, elements: next, stats };
}

async function runRestore() {
  console.log(`[restore] reading ${RESTORE_FILE}`);
  const backup = JSON.parse(readFileSync(RESTORE_FILE, 'utf8'));
  let total = 0;
  for (const table of TABLES) {
    const rows = backup[table] || [];
    console.log(`[restore] ${table}: ${rows.length} rows`);
    if (!APPLY) continue;
    for (const r of rows) {
      const { error } = await supabase.from(table).update({ elements: r.elements }).eq('id', r.id);
      if (error) throw new Error(`restore ${table} ${r.id} failed: ${error.message}`);
      total += 1;
    }
  }
  console.log(APPLY ? `[restore] restored ${total} rows` : '[restore] DRY-RUN (add --apply to write)');
}

async function run() {
  if (RESTORE_FILE) return runRestore();

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`R2 base: ${R2_PUBLIC_BASE_URL}`);

  const onR2 = await fetchOnR2Paths();
  console.log(`default_images on R2: ${onR2.size} paths`);

  // 1) Collect affected rows and write a backup first.
  const backup = {};
  const affected = {};
  for (const table of TABLES) {
    const all = await fetchAll(table);
    const hit = all.filter(rowHasMarker);
    backup[table] = hit.map((r) => ({ id: r.id, elements: r.elements }));
    affected[table] = hit;
    console.log(`${table}: ${hit.length} rows reference supabase default-images`);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `defimg-jsonb-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath}`);

  // 2) Compute + (optionally) apply rewrites.
  let totalRowsChanged = 0;
  let totalRefsRewritten = 0;
  let totalRefsLeft = 0;
  for (const table of TABLES) {
    let rowsChanged = 0;
    let refsRewritten = 0;
    let refsLeft = 0;
    for (const r of affected[table]) {
      const { changed, elements, stats } = rewriteElements(r.elements, onR2);
      refsRewritten += stats.rewritten;
      refsLeft += stats.missingLeft;
      if (!changed) continue;
      rowsChanged += 1;
      if (APPLY) {
        const { error } = await supabase.from(table).update({ elements }).eq('id', r.id);
        if (error) throw new Error(`update ${table} ${r.id} failed: ${error.message}`);
      }
    }
    totalRowsChanged += rowsChanged;
    totalRefsRewritten += refsRewritten;
    totalRefsLeft += refsLeft;
    console.log(
      `${table}: rows changed=${rowsChanged}, refs rewritten=${refsRewritten}, refs left (orphan/missing)=${refsLeft}`,
    );
  }

  console.log('---');
  console.log(`TOTAL rows changed: ${totalRowsChanged}`);
  console.log(`TOTAL refs rewritten -> R2: ${totalRefsRewritten}`);
  console.log(`TOTAL refs left untouched (orphan_alive/missing): ${totalRefsLeft}`);
  console.log(APPLY ? 'APPLIED.' : 'DRY-RUN only. Re-run with --apply to write.');
  console.log(`Restore with: node scripts/rewrite-jsonb-default-images-to-r2.mjs --restore ${backupPath} --apply`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
