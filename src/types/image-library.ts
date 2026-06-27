import type { StorageProvider } from '../utils/assetUrl';
import type { AssetRole, AssetScope, AssetSourceContext, WorkSeriesSlug } from '../utils/libraryAssets';

export interface DefaultImage {
  id: string;
  name: string;
  storage_path: string;
  thumbnail_path?: string | null;
  // Storage backend for storage_path / thumbnail_path. Legacy rows are
  // 'supabase'; backfilled rows flip to 'r2'. Absent -> treat as 'supabase'.
  storage_provider?: StorageProvider;
  width: number | null;
  height: number | null;
  file_size: number | null;
  source_context?: 'library' | 'content_factory' | 'automation' | 'migration' | null;
  work_series_slug?: WorkSeriesSlug | null;
  work_number?: number | null;
  variant_number?: number | null;
  asset_role?: AssetRole | null;
  tags: string[] | null;
  notes?: string | null;
  created_at: string;
}

export interface UserImage {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  thumbnail_path?: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  asset_scope: AssetScope;
  source_context: AssetSourceContext;
  work_series_slug: WorkSeriesSlug | null;
  work_number: number | null;
  variant_number: number | null;
  asset_role: AssetRole;
  tags: string[] | null;
  notes: string | null;
  created_at: string;
}
