import { getSupabase, getSupabaseStoragePublicUrl } from './supabase';
import type { ProductionProjectSummary } from '../types/production-project';

type GallerySeriesRow = {
  id: string;
  slug: string;
  name: string;
};

type WorkRow = {
  id: string;
  title: string;
  theme_category: string;
  summary: string | null;
  released_on: string | null;
  legacy_episode_id: number | null;
  is_featured: boolean;
};

type WorkVariantRow = {
  id: string;
  title: string | null;
  caption: string | null;
};

type WorkOfferRow = {
  id: string;
};

type ProductionOutputRow = {
  role: string;
  storage_bucket: string | null;
  storage_path: string | null;
  width: number | null;
  height: number | null;
  status: string;
};

const WALLPAPER_OUTPUT_ROLES = [
  'mobile_hd',
  'mobile_qhd',
  'pc_hd',
  'pc_qhd',
  'package_cover',
] as const;

function buildWorkSlug(seriesSlug: string, displayCode: string): string {
  return `${seriesSlug}-${displayCode}`.toLowerCase();
}

function buildWallpaperTargetUrl(
  seriesSlug: string,
  displayCode: string,
  variantNumber: number,
): string {
  return variantNumber > 1
    ? `/works/${seriesSlug}/${displayCode}/wallpaper?variant=${variantNumber}`
    : `/works/${seriesSlug}/${displayCode}/wallpaper`;
}

async function loadSeries(slug: string): Promise<GallerySeriesRow> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('work_series')
    .select('id, slug, name')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    throw new Error(`Failed to resolve gallery work series "${slug}".`);
  }

  return data as GallerySeriesRow;
}

async function loadCurrentOutputs(projectId: string): Promise<ProductionOutputRow[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('production_outputs')
    .select('role, storage_bucket, storage_path, width, height, status')
    .eq('project_id', projectId)
    .eq('is_current', true);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductionOutputRow[];
}

export async function syncGalleryWorkFromProductionProject(
  project: ProductionProjectSummary,
): Promise<void> {
  const supabase = await getSupabase();
  const series = await loadSeries(project.project.work_series_slug);
  const outputs = await loadCurrentOutputs(project.project.id);

  const feedOutput = outputs.find(
    (output) =>
      output.role === 'instagram_feed' &&
      output.status === 'ready' &&
      output.storage_bucket &&
      output.storage_path,
  );

  if (!feedOutput?.storage_bucket || !feedOutput.storage_path) {
    throw new Error('Gallery sync requires a ready instagram_feed output.');
  }

  const wallpaperPackReady = WALLPAPER_OUTPUT_ROLES.every((role) =>
    outputs.some((output) => output.role === role && output.status === 'ready'),
  );

  const displayCode = project.project.work_display_code;
  const variantNumber = project.project.variant_number;
  const fallbackTitle = `${series.name} ${displayCode}`;
  const feedPublicUrl = getSupabaseStoragePublicUrl(
    feedOutput.storage_bucket,
    feedOutput.storage_path,
  );

  const { data: existingWorkData, error: existingWorkError } = await supabase
    .from('works')
    .select('id, title, theme_category, summary, released_on, legacy_episode_id, is_featured')
    .eq('series_id', series.id)
    .eq('display_code', displayCode)
    .maybeSingle();

  if (existingWorkError) {
    throw existingWorkError;
  }

  const existingWork = existingWorkData as WorkRow | null;

  const workPayload = {
    series_id: series.id,
    legacy_episode_id: existingWork?.legacy_episode_id ?? null,
    sequence_number: project.project.work_number,
    display_code: displayCode,
    slug: buildWorkSlug(project.project.work_series_slug, displayCode),
    title: existingWork?.title?.trim() ? existingWork.title : fallbackTitle,
    theme_category: existingWork?.theme_category ?? '',
    summary: existingWork?.summary ?? null,
    released_on: existingWork?.released_on ?? null,
    status: 'published',
    published_at: new Date().toISOString(),
    is_featured: existingWork?.is_featured ?? false,
  };

  let workId = existingWork?.id ?? null;
  if (workId) {
    const { error } = await supabase
      .from('works')
      .update(workPayload)
      .eq('id', workId);

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase
      .from('works')
      .insert(workPayload)
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create gallery work.');
    }

    workId = data.id;
  }

  if (!workId) {
    throw new Error('Failed to resolve gallery work id.');
  }

  const { data: existingVariantData, error: existingVariantError } = await supabase
    .from('work_variants')
    .select('id, title, caption')
    .eq('work_id', workId)
    .eq('variant_number', variantNumber)
    .maybeSingle();

  if (existingVariantError) {
    throw existingVariantError;
  }

  const existingVariant = existingVariantData as WorkVariantRow | null;

  if (variantNumber === 1) {
    const { error } = await supabase
      .from('work_variants')
      .update({ is_primary: false })
      .eq('work_id', workId)
      .neq('variant_number', 1);

    if (error) {
      throw error;
    }
  }

  const variantPayload = {
    work_id: workId,
    variant_number: variantNumber,
    display_code: `${displayCode}-${variantNumber}`,
    title: existingVariant?.title ?? null,
    caption: existingVariant?.caption ?? null,
    variant_type: 'image',
    original_storage_key: feedPublicUrl,
    thumbnail_storage_key: feedPublicUrl,
    width: feedOutput.width,
    height: feedOutput.height,
    status: 'ready',
    sort_order: variantNumber,
    is_primary: variantNumber === 1,
  };

  let variantId = existingVariant?.id ?? null;
  if (variantId) {
    const { error } = await supabase
      .from('work_variants')
      .update(variantPayload)
      .eq('id', variantId);

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase
      .from('work_variants')
      .insert(variantPayload)
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create gallery variant.');
    }

    variantId = data.id;
  }

  if (!variantId) {
    throw new Error('Failed to resolve gallery variant id.');
  }

  const wallpaperOfferPayload = {
    work_id: workId,
    variant_id: variantId,
    offer_type: 'wallpaper',
    plan_type: 'premium',
    status: wallpaperPackReady ? 'ready' : 'preparing',
    title: 'Wallpaper Pack',
    description: 'Published from Content Factory production outputs.',
    target_ref: project.project.id,
    target_url: wallpaperPackReady
      ? buildWallpaperTargetUrl(project.project.work_series_slug, displayCode, variantNumber)
      : null,
    sort_order: 1,
  };

  const { data: existingWallpaperOfferData, error: existingWallpaperOfferError } = await supabase
    .from('work_offers')
    .select('id')
    .eq('variant_id', variantId)
    .eq('offer_type', 'wallpaper')
    .maybeSingle();

  if (existingWallpaperOfferError) {
    throw existingWallpaperOfferError;
  }

  let wallpaperOfferId = (existingWallpaperOfferData as WorkOfferRow | null)?.id ?? null;
  if (wallpaperOfferId) {
    const { error } = await supabase
      .from('work_offers')
      .update(wallpaperOfferPayload)
      .eq('id', wallpaperOfferId);

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase
      .from('work_offers')
      .insert(wallpaperOfferPayload)
      .select('id')
      .single();

    if (error || !data) {
      throw error ?? new Error('Failed to create gallery wallpaper offer.');
    }

    wallpaperOfferId = data.id;
  }

  if (wallpaperOfferId) {
    const { error } = await supabase
      .from('production_delivery_packages')
      .update({ gallery_offer_ref: wallpaperOfferId })
      .eq('project_id', project.project.id);

    if (error) {
      throw error;
    }
  }
}
