import { getSupabase } from './supabase';

export const WORK_SERIES_OPTIONS = [
  { value: 'episode', label: 'Episode' },
  { value: 'reel', label: 'Reel' },
  { value: 'experiment', label: 'Experiment' },
  { value: 'remix', label: 'Remix' },
] as const;

export const OFFICIAL_ASSET_ROLE_OPTIONS = [
  { value: 'character_cutout', label: 'Character Cutout' },
  { value: 'background', label: 'Background' },
  { value: 'logo', label: 'Logo' },
  { value: 'reference', label: 'Reference' },
  { value: 'derived', label: 'Derived Output' },
  { value: 'general', label: 'General' },
] as const;

export type WorkSeriesSlug = (typeof WORK_SERIES_OPTIONS)[number]['value'];
export type AssetScope = 'user' | 'official';
export type AssetSourceContext = 'editor' | 'content_factory' | 'automation' | 'migration';
export type AssetRole =
  | 'general'
  | 'character_cutout'
  | 'background'
  | 'logo'
  | 'reference'
  | 'shadow'
  | 'derived';

interface InsertUserImageRecordInput {
  userId: string;
  name: string;
  storagePath: string;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  assetScope?: AssetScope;
  sourceContext?: AssetSourceContext;
  workSeriesSlug?: WorkSeriesSlug | null;
  workNumber?: number | null;
  variantNumber?: number | null;
  assetRole?: AssetRole;
  tags?: string[];
  notes?: string | null;
}

export const formatWorkDisplayCode = (workNumber: number | null | undefined): string => {
  if (!workNumber || workNumber < 1) {
    return '----';
  }

  return String(workNumber).padStart(4, '0');
};

export const formatSeriesLabel = (seriesSlug: WorkSeriesSlug | string | null | undefined): string => {
  if (!seriesSlug) {
    return 'Unassigned';
  }

  const matched = WORK_SERIES_OPTIONS.find((option) => option.value === seriesSlug);
  if (matched) {
    return matched.label;
  }

  return seriesSlug;
};

export const formatWorkVariantLabel = (asset: {
  work_series_slug?: string | null;
  work_number?: number | null;
  variant_number?: number | null;
}): string => {
  if (!asset.work_series_slug || !asset.work_number) {
    return 'Unassigned';
  }

  const code = formatWorkDisplayCode(asset.work_number);
  const variant = asset.variant_number ?? 1;
  return `${formatSeriesLabel(asset.work_series_slug)} ${code}-${variant}`;
};

export const parseTagInput = (value: string): string[] => {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const insertUserImageRecord = async ({
  userId,
  name,
  storagePath,
  width,
  height,
  fileSize,
  assetScope = 'user',
  sourceContext = 'editor',
  workSeriesSlug = null,
  workNumber = null,
  variantNumber = null,
  assetRole = 'general',
  tags = [],
  notes = null,
}: InsertUserImageRecordInput): Promise<void> => {
  const supabase = await getSupabase();
  const { error } = await supabase.from('user_images').insert({
    user_id: userId,
    name,
    storage_path: storagePath,
    width,
    height,
    file_size: fileSize,
    asset_scope: assetScope,
    source_context: sourceContext,
    work_series_slug: workSeriesSlug,
    work_number: workNumber,
    variant_number: variantNumber,
    asset_role: assetRole,
    tags,
    notes,
  });

  if (error) {
    console.error('Failed to insert user_images record:', error);
    throw error;
  }
};
