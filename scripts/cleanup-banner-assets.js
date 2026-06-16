/**
 * Remove orphaned banner thumbnails/download assets from Supabase Storage.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-banner-assets.js
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/cleanup-banner-assets.js --apply
 *
 * Default mode is dry-run. Pass --apply to actually delete files.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

const bucket = 'user-images';
const applyChanges = process.argv.includes('--apply');
const publicPrefix = '/storage/v1/object/public/user-images/';

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const extractStoragePath = (publicUrl) => {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    const prefixIndex = url.pathname.indexOf(publicPrefix);
    if (prefixIndex === -1) return null;

    const encodedPath = url.pathname.slice(prefixIndex + publicPrefix.length);
    return encodedPath
      .split('/')
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  } catch {
    return null;
  }
};

const listPaths = async (path) => {
  const { data, error } = await supabase.storage.from(bucket).list(path, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (error) {
    if (error.message?.includes('not found')) {
      return [];
    }
    throw error;
  }

  return data || [];
};

const getKeepPaths = async () => {
  const keepPaths = new Set();

  const { data: banners, error } = await supabase
    .from('banners')
    .select('thumbnail_url, fullres_url')
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  for (const banner of banners || []) {
    const thumbnailPath = extractStoragePath(banner.thumbnail_url);
    const fullresPath = extractStoragePath(banner.fullres_url);

    if (thumbnailPath) keepPaths.add(thumbnailPath);
    if (fullresPath) keepPaths.add(fullresPath);
  }

  return keepPaths;
};

const getUserFolders = async () => {
  const rootEntries = await listPaths('');
  const folderNames = rootEntries
    .map((entry) => entry.name)
    .filter(Boolean);

  return [...new Set(folderNames)];
};

const main = async () => {
  console.log('=== Banner Asset Cleanup ===');
  console.log(applyChanges ? 'Mode: APPLY' : 'Mode: DRY RUN');

  const keepPaths = await getKeepPaths();
  const userFolders = await getUserFolders();
  const deletePaths = [];

  for (const userFolder of userFolders) {
    for (const subdir of ['thumbnails', 'downloads']) {
      const directoryPath = `${userFolder}/${subdir}`;
      let entries = [];

      try {
        entries = await listPaths(directoryPath);
      } catch (error) {
        console.warn(`Skipping ${directoryPath}: ${error.message}`);
        continue;
      }

      for (const entry of entries) {
        if (!entry.name || !entry.id) continue;

        const storagePath = `${directoryPath}/${entry.name}`;
        if (!keepPaths.has(storagePath)) {
          deletePaths.push(storagePath);
        }
      }
    }
  }

  console.log(`Tracked assets: ${keepPaths.size}`);
  console.log(`Orphaned assets: ${deletePaths.length}`);

  if (deletePaths.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  deletePaths.forEach((path) => {
    console.log(`${applyChanges ? 'DELETE' : 'DRY'} ${path}`);
  });

  if (!applyChanges) {
    console.log('\nRun again with --apply to delete these files.');
    return;
  }

  for (const paths of chunk(deletePaths, 100)) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      throw error;
    }
  }

  console.log('Cleanup complete.');
};

main().catch((error) => {
  console.error('Banner asset cleanup failed:', error);
  process.exit(1);
});
