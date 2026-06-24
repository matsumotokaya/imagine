import { getSupabase } from './supabase';
import { formatWorkDisplayCode, type WorkSeriesSlug } from './libraryAssets';

type WorkSeriesRow = {
  id: string;
  name: string;
};

type WorkRow = {
  id: string;
  legacy_episode_id: number | null;
  title: string;
  theme_category: string;
  summary: string | null;
  released_on: string | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  is_featured: boolean;
};

type WorkVariantRow = {
  id: string;
  title: string | null;
  caption: string | null;
  original_storage_key: string | null;
  thumbnail_storage_key: string | null;
  width: number | null;
  height: number | null;
  status: 'ready' | 'preparing' | 'hidden';
};

type WorkTagRow = {
  id: string;
  slug: string;
  label: string;
  tag_type: string;
};

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildWorkSlug(seriesSlug: string, displayCode: string): string {
  return `${seriesSlug}-${displayCode}`.toLowerCase();
}

function slugifyTag(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function syncWorkTags(params: {
  workId: string;
  tags: string[];
}): Promise<void> {
  const supabase = await getSupabase();
  const normalized = Array.from(
    new Map(
      params.tags
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => [slugifyTag(label), label] as const)
        .filter(([slug]) => slug.length > 0)
    ).entries()
  ).map(([slug, label]) => ({ slug, label }));

  if (normalized.length === 0) {
    const { error } = await supabase
      .from('work_tag_map')
      .delete()
      .eq('work_id', params.workId);

    if (error) {
      throw error;
    }

    return;
  }

  const { data: existingTagsData, error: existingTagsError } = await supabase
    .from('work_tags')
    .select('id, slug, label, tag_type')
    .in('slug', normalized.map((tag) => tag.slug));

  if (existingTagsError) {
    throw existingTagsError;
  }

  const existingTags = (existingTagsData ?? []) as WorkTagRow[];
  const existingBySlug = new Map(existingTags.map((tag) => [tag.slug, tag]));

  const missing = normalized.filter((tag) => !existingBySlug.has(tag.slug));
  if (missing.length > 0) {
    const { error: insertTagError } = await supabase
      .from('work_tags')
      .insert(
        missing.map((tag) => ({
          slug: tag.slug,
          label: tag.label,
          tag_type: 'general',
        }))
      );

    if (insertTagError) {
      throw insertTagError;
    }
  }

  const { data: allTagsData, error: allTagsError } = await supabase
    .from('work_tags')
    .select('id, slug, label, tag_type')
    .in('slug', normalized.map((tag) => tag.slug));

  if (allTagsError) {
    throw allTagsError;
  }

  const allTags = (allTagsData ?? []) as WorkTagRow[];
  const tagIds = allTags.map((tag) => tag.id);

  const { data: existingMapData, error: existingMapError } = await supabase
    .from('work_tag_map')
    .select('tag_id')
    .eq('work_id', params.workId);

  if (existingMapError) {
    throw existingMapError;
  }

  const existingTagIds = new Set((existingMapData ?? []).map((row) => row.tag_id as string));
  const missingMapRows = tagIds
    .filter((tagId) => !existingTagIds.has(tagId))
    .map((tagId) => ({
      work_id: params.workId,
      tag_id: tagId,
    }));

  if (missingMapRows.length > 0) {
    const { error: insertMapError } = await supabase
      .from('work_tag_map')
      .insert(missingMapRows);

    if (insertMapError) {
      throw insertMapError;
    }
  }

  const staleTagIds = Array.from(existingTagIds).filter((tagId) => !tagIds.includes(tagId));
  if (staleTagIds.length > 0) {
    const { error: deleteMapError } = await supabase
      .from('work_tag_map')
      .delete()
      .eq('work_id', params.workId)
      .in('tag_id', staleTagIds);

    if (deleteMapError) {
      throw deleteMapError;
    }
  }
}

export async function ensureCanonicalWorkVariant(params: {
  workSeriesSlug: WorkSeriesSlug;
  workNumber: number;
  variantNumber: number;
  workTitle?: string | null;
  workSummary?: string | null;
  releasedOn?: string | null;
  workTags?: string[];
  variantTitle?: string | null;
  variantCaption?: string | null;
}): Promise<{
  workId: string;
  variantId: string;
  displayCode: string;
  variantDisplayCode: string;
}> {
  const supabase = await getSupabase();
  const displayCode = formatWorkDisplayCode(params.workNumber);
  const variantNumber = params.variantNumber;
  const variantDisplayCode = `${displayCode}-${variantNumber}`;

  const { data: series, error: seriesError } = await supabase
    .from('work_series')
    .select('id, name')
    .eq('slug', params.workSeriesSlug)
    .single();

  if (seriesError || !series) {
    throw seriesError ?? new Error(`Failed to resolve work series "${params.workSeriesSlug}".`);
  }

  const seriesRow = series as WorkSeriesRow;
  const fallbackTitle = `${seriesRow.name} ${displayCode}`;

  const { data: existingWorkData, error: existingWorkError } = await supabase
    .from('works')
    .select('id, legacy_episode_id, title, theme_category, summary, released_on, status, published_at, is_featured')
    .eq('series_id', seriesRow.id)
    .eq('display_code', displayCode)
    .maybeSingle();

  if (existingWorkError) {
    throw existingWorkError;
  }

  const existingWork = existingWorkData as WorkRow | null;
  const nextWorkTitle =
    params.workTitle !== undefined
      ? normalizeOptionalText(params.workTitle) ?? existingWork?.title?.trim() ?? fallbackTitle
      : existingWork?.title?.trim() ?? fallbackTitle;
  const nextWorkSummary =
    params.workSummary !== undefined
      ? normalizeOptionalText(params.workSummary)
      : existingWork?.summary ?? null;
  const nextReleasedOn =
    params.releasedOn !== undefined
      ? normalizeOptionalText(params.releasedOn)
      : existingWork?.released_on ?? null;

  const workPayload = {
    series_id: seriesRow.id,
    legacy_episode_id: existingWork?.legacy_episode_id ?? null,
    sequence_number: params.workNumber,
    display_code: displayCode,
    slug: buildWorkSlug(params.workSeriesSlug, displayCode),
    title: nextWorkTitle,
    theme_category: existingWork?.theme_category ?? '',
    summary: nextWorkSummary,
    released_on: nextReleasedOn,
    status: existingWork?.status ?? 'draft',
    published_at: existingWork?.published_at ?? null,
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
      throw error ?? new Error('Failed to create canonical work.');
    }

    workId = data.id;
  }

  if (!workId) {
    throw new Error('Failed to resolve canonical work id.');
  }

  const { data: existingVariantData, error: existingVariantError } = await supabase
    .from('work_variants')
    .select('id, title, caption, original_storage_key, thumbnail_storage_key, width, height, status')
    .eq('work_id', workId)
    .eq('variant_number', variantNumber)
    .maybeSingle();

  if (existingVariantError) {
    throw existingVariantError;
  }

  const existingVariant = existingVariantData as WorkVariantRow | null;
  const nextVariantTitle = normalizeOptionalText(params.variantTitle) ?? existingVariant?.title ?? null;
  const nextVariantCaption = normalizeOptionalText(params.variantCaption) ?? existingVariant?.caption ?? null;

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
    display_code: variantDisplayCode,
    title: nextVariantTitle,
    caption: nextVariantCaption,
    variant_type: 'image',
    original_storage_key: existingVariant?.original_storage_key ?? null,
    thumbnail_storage_key: existingVariant?.thumbnail_storage_key ?? null,
    width: existingVariant?.width ?? null,
    height: existingVariant?.height ?? null,
    status: existingVariant?.status ?? 'preparing',
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
      throw error ?? new Error('Failed to create canonical work variant.');
    }

    variantId = data.id;
  }

  if (!variantId) {
    throw new Error('Failed to resolve canonical work variant id.');
  }

  if (params.workTags !== undefined) {
    await syncWorkTags({
      workId,
      tags: params.workTags,
    });
  }

  return {
    workId,
    variantId,
    displayCode,
    variantDisplayCode,
  };
}
