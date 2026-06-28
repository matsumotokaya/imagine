/**
 * One-off remap: the old 0443 library asset `1774951043581-j4dsb-0443_001_raw.png`
 * was deleted from Supabase when episode 0443 was re-uploaded to the premium
 * library, leaving banners/templates that referenced it with a broken (404)
 * character image. The same character exists in the current library on R2 at
 * `official/episode/0443-1/1781879469808-hqr31avz8mk.png`, so we re-point every
 * broken reference to it instead of deleting other users' content.
 *
 * Safety: writes a JSON backup of affected rows (id + elements) before any
 * change. DRY-RUN by default; add --apply to write. --restore <file> --apply
 * restores elements from a backup.
 *
 * Env (imagine/.env.r2backfill.local): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const APPLY = process.argv.includes('--apply');
const restoreIdx = process.argv.indexOf('--restore');
const RESTORE_FILE = restoreIdx >= 0 ? process.argv[restoreIdx + 1] : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const TABLES = ['banners', 'templates'];
const OLD_MARKER = '1774951043581-j4dsb-0443_001_raw.png';
const NEW_URL =
  'https://assets.whatif-ep.xyz/default-images/official/episode/0443-1/1781879469808-hqr31avz8mk.png';
const BACKUP_DIR = join(__dirname, 'backups');

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

function remapElements(elements) {
  let changed = 0;
  if (!Array.isArray(elements)) return { changed, elements };
  const next = elements.map((el) => {
    if (el && typeof el.src === 'string' && el.src.includes(OLD_MARKER)) {
      changed += 1;
      return { ...el, src: NEW_URL };
    }
    return el;
  });
  return { changed, elements: next };
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
  console.log(`Remap ${OLD_MARKER} -> ${NEW_URL}`);

  const backup = {};
  const affected = {};
  for (const table of TABLES) {
    const all = await fetchAll(table);
    const hit = all.filter((r) => JSON.stringify(r.elements ?? null).includes(OLD_MARKER));
    backup[table] = hit.map((r) => ({ id: r.id, elements: r.elements }));
    affected[table] = hit;
    console.log(`${table}: ${hit.length} rows reference the old raw asset`);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `remap-0443-backup-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  console.log(`Backup written: ${backupPath}`);

  let totalRows = 0;
  let totalRefs = 0;
  for (const table of TABLES) {
    let rows = 0;
    let refs = 0;
    for (const r of affected[table]) {
      const { changed, elements } = remapElements(r.elements);
      if (!changed) continue;
      rows += 1;
      refs += changed;
      if (APPLY) {
        const { error } = await supabase.from(table).update({ elements }).eq('id', r.id);
        if (error) throw new Error(`update ${table} ${r.id} failed: ${error.message}`);
      }
    }
    totalRows += rows;
    totalRefs += refs;
    console.log(`${table}: rows changed=${rows}, refs remapped=${refs}`);
  }

  console.log('---');
  console.log(`TOTAL rows changed: ${totalRows}, refs remapped: ${totalRefs}`);
  console.log(APPLY ? 'APPLIED.' : 'DRY-RUN only. Re-run with --apply to write.');
  console.log(`Restore: node scripts/remap-0443-raw-to-r2.mjs --restore ${backupPath} --apply`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
