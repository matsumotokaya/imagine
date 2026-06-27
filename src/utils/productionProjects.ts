import { getSupabase } from './supabase';
import type { DefaultImage } from '../types/image-library';
import type { CanvasElement, ImageElement, Template, TextElement } from '../types/template';
import type {
  ProductionBannerSummary,
  ProductionProject,
  ProductionProjectBannerLink,
  ProductionProjectBannerRole,
  ProductionProjectSummary,
} from '../types/production-project';
import { formatSeriesLabel, formatWorkDisplayCode } from './libraryAssets';
import { ensureCanonicalWorkVariant } from './canonicalWorks';
import { getFitToCanvasPlacement } from './canvasPlacement';
import { appendCacheBust, extractStoragePathFromPublicUrl, removeFilesFromBucket } from './storage';
import { resolveAssetUrl, type StorageProvider } from './assetUrl';

const DEFAULT_DRAFT_CANVAS_COLOR = '#808080';
const INSTAGRAM_FEED_ACCENT_COLOR = '#fd4d52';
const INSTAGRAM_FEED_TITLE_FONT = '"Bebas Neue", sans-serif';
const INSTAGRAM_FEED_BODY_FONT = 'Arial';
const BANNER_ASSET_BUCKET = 'user-images';
const INSTAGRAM_FEED_BODY_TEXT =
  '- Your design is 99% done.You just finish it.\n' +
  '- Phone wallpapers, SNS headers, custom icons and thumbnails. \n' +
  '- Create freely and easily with IMAGINE, the simple design tool.';

type DraftBannerSpec = {
  role: Exclude<ProductionProjectBannerRole, 'imagine_template'>;
  sortOrder: number;
  template: Template;
  canvasColor: string;
};

const DRAFT_BANNER_SPECS: DraftBannerSpec[] = [
  {
    role: 'portrait_master',
    sortOrder: 1,
    template: {
      id: 'factory-portrait-master',
      name: 'Portrait',
      width: 1440,
      height: 2560,
      backgroundColor: DEFAULT_DRAFT_CANVAS_COLOR,
    },
    canvasColor: DEFAULT_DRAFT_CANVAS_COLOR,
  },
  {
    role: 'landscape_master',
    sortOrder: 2,
    template: {
      id: 'factory-landscape-master',
      name: 'Landscape',
      width: 2560,
      height: 1440,
      backgroundColor: DEFAULT_DRAFT_CANVAS_COLOR,
    },
    canvasColor: DEFAULT_DRAFT_CANVAS_COLOR,
  },
  {
    role: 'instagram_feed',
    sortOrder: 3,
    template: {
      id: 'factory-instagram-feed',
      name: 'Feed',
      width: 1080,
      height: 1350,
      backgroundColor: DEFAULT_DRAFT_CANVAS_COLOR,
    },
    canvasColor: DEFAULT_DRAFT_CANVAS_COLOR,
  },
];

type DbAssetLink = {
  id: string;
  project_id: string;
  default_image_id: string;
  role: string;
  sort_order: number;
  is_primary: boolean;
};

type DbCanonicalWorkRow = {
  id: string;
  title: string;
  summary: string | null;
  released_on: string | null;
};

type DbWorkTagRow = {
  id: string;
  label: string;
};

const ROLE_LABELS: Record<Exclude<ProductionProjectBannerRole, 'imagine_template'>, string> = {
  portrait_master: 'Portrait',
  landscape_master: 'Landscape',
  instagram_feed: 'Feed',
  package_cover: 'Cover',
};

function getAssetDimensions(asset: DefaultImage): { width: number; height: number } {
  const width = asset.width && asset.width > 0 ? asset.width : 1200;
  const height = asset.height && asset.height > 0 ? asset.height : 1600;
  return { width, height };
}

function buildCenteredImageElement(asset: DefaultImage, spec: DraftBannerSpec): ImageElement {
  const src = resolveAssetUrl(asset.storage_provider ?? 'supabase', 'default-images', asset.storage_path);
  const { width: sourceWidth, height: sourceHeight } = getAssetDimensions(asset);
  const placement = getFitToCanvasPlacement(
    spec.template.width,
    spec.template.height,
    sourceWidth,
    sourceHeight,
  );

  return {
    id: `image-${spec.role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    src,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    visible: true,
    opacity: 1,
  };
}

function buildInstagramFeedTitle(asset: DefaultImage): string {
  const workCode = formatWorkDisplayCode(asset.work_number ?? 0);
  return `/IMAGINE: EP${workCode}`;
}

function buildInstagramFeedTextElements(asset: DefaultImage): TextElement[] {
  return [
    {
      id: `text-instagram-feed-title-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'text',
      text: buildInstagramFeedTitle(asset),
      x: 45.72138853617555,
      y: 1262.8333333333335,
      visible: true,
      opacity: 1,
      fill: INSTAGRAM_FEED_ACCENT_COLOR,
      fillEnabled: true,
      stroke: '#000000',
      strokeWidth: 2,
      strokeEnabled: false,
      fontSize: 55,
      fontFamily: INSTAGRAM_FEED_TITLE_FONT,
      fontWeight: 400,
      letterSpacing: 0,
    },
    {
      id: `text-instagram-feed-body-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: 'text',
      text: INSTAGRAM_FEED_BODY_TEXT,
      x: 396.73359241730446,
      y: 1262.277777777778,
      visible: true,
      opacity: 1,
      fill: INSTAGRAM_FEED_ACCENT_COLOR,
      fillEnabled: true,
      stroke: '#000000',
      strokeWidth: 2,
      strokeEnabled: false,
      fontSize: 16,
      fontFamily: INSTAGRAM_FEED_BODY_FONT,
      fontWeight: 400,
      letterSpacing: 0,
    },
  ];
}

function buildDraftBannerElements(asset: DefaultImage, spec: DraftBannerSpec): CanvasElement[] {
  const elements: CanvasElement[] = [buildCenteredImageElement(asset, spec)];

  if (spec.role === 'instagram_feed') {
    elements.push(...buildInstagramFeedTextElements(asset));
  }

  return elements;
}

function buildProjectTitle(asset: DefaultImage): string {
  const seriesLabel = formatSeriesLabel(asset.work_series_slug ?? 'episode').toUpperCase();
  const workCode = formatWorkDisplayCode(asset.work_number ?? 0);
  const variantNumber = asset.variant_number ?? 1;
  return `${seriesLabel} ${workCode}-${variantNumber}`;
}

function buildBannerName(asset: DefaultImage, role: DraftBannerSpec['role']): string {
  return `${buildProjectTitle(asset)} ${ROLE_LABELS[role]}`;
}

function normalizeProjectText(value: string | null | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

async function loadProjectSummariesByIds(projectIds: string[]): Promise<ProductionProjectSummary[]> {
  if (projectIds.length === 0) {
    return [];
  }

  const supabase = await getSupabase();
  const { data: projects, error: projectsError } = await supabase
    .from('production_projects')
    .select('*')
    .in('id', projectIds)
    .order('updated_at', { ascending: false });

  if (projectsError) {
    throw projectsError;
  }

  const { data: projectBanners, error: projectBannersError } = await supabase
    .from('production_project_banners')
    .select('*')
    .in('project_id', projectIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (projectBannersError) {
    throw projectBannersError;
  }

  const { data: projectAssets, error: projectAssetsError } = await supabase
    .from('production_project_assets')
    .select('*')
    .in('project_id', projectIds)
    .order('sort_order', { ascending: true });

  if (projectAssetsError) {
    throw projectAssetsError;
  }

  const bannerIds = Array.from(new Set((projectBanners ?? []).map((row) => row.banner_id)));
  const assetIds = Array.from(new Set((projectAssets ?? []).map((row) => row.default_image_id)));
  const workIds = Array.from(
    new Set(
      ((projects ?? []) as ProductionProject[])
        .map((project) => project.work_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const bannerMap = new Map<string, ProductionBannerSummary>();
  if (bannerIds.length > 0) {
    const { data: banners, error: bannersError } = await supabase
      .from('banners')
      .select('id, name, updated_at, thumbnail_url, fullres_url, template')
      .in('id', bannerIds);

    if (bannersError) {
      throw bannersError;
    }

    for (const banner of (banners ?? []) as ProductionBannerSummary[]) {
      bannerMap.set(banner.id, banner);
    }
  }

  const assetMap = new Map<string, { id: string; name: string; storage_path: string; storage_provider?: StorageProvider }>();
  if (assetIds.length > 0) {
    const { data: assets, error: assetsError } = await supabase
      .from('default_images')
      .select('id, name, storage_path, storage_provider')
      .in('id', assetIds);

    if (assetsError) {
      throw assetsError;
    }

    for (const asset of assets ?? []) {
      assetMap.set(asset.id, asset);
    }
  }

  const bannersByProject = new Map<string, ProductionProjectSummary['banners']>();
  for (const link of (projectBanners ?? []) as ProductionProjectBannerLink[]) {
    const banner = bannerMap.get(link.banner_id);
    if (!banner) {
      continue;
    }

    const projectBannersForProject = bannersByProject.get(link.project_id) ?? [];
    projectBannersForProject.push({
      linkId: link.id,
      bannerId: link.banner_id,
      role: link.role,
      sortOrder: link.sort_order,
      name: banner.name,
      thumbnailUrl: appendCacheBust(
        banner.thumbnail_url ?? '',
        banner.updated_at,
      ) || null,
      fullresUrl: appendCacheBust(banner.fullres_url ?? '', banner.updated_at) || null,
      width: banner.template?.width,
      height: banner.template?.height,
    });
    bannersByProject.set(link.project_id, projectBannersForProject);
  }

  const primaryAssetsByProject = new Map<string, { id: string; name: string; storage_path: string; storage_provider?: StorageProvider } | null>();
  for (const link of (projectAssets ?? []) as DbAssetLink[]) {
    const existing = primaryAssetsByProject.get(link.project_id);
    if (existing) {
      continue;
    }

    const asset = assetMap.get(link.default_image_id);
    primaryAssetsByProject.set(link.project_id, asset ?? null);
  }

  const canonicalWorkById = new Map<string, ProductionProjectSummary['canonicalWork']>();
  if (workIds.length > 0) {
    const { data: works, error: worksError } = await supabase
      .from('works')
      .select('id, title, summary, released_on')
      .in('id', workIds);

    if (worksError) {
      throw worksError;
    }

    const { data: tagMapRows, error: tagMapError } = await supabase
      .from('work_tag_map')
      .select('work_id, tag_id')
      .in('work_id', workIds);

    if (tagMapError) {
      throw tagMapError;
    }

    const tagIds = Array.from(new Set((tagMapRows ?? []).map((row) => row.tag_id as string)));
    const tagLabelById = new Map<string, string>();
    if (tagIds.length > 0) {
      const { data: tagRows, error: tagRowsError } = await supabase
        .from('work_tags')
        .select('id, label')
        .in('id', tagIds);

      if (tagRowsError) {
        throw tagRowsError;
      }

      for (const tag of (tagRows ?? []) as DbWorkTagRow[]) {
        tagLabelById.set(tag.id, tag.label);
      }
    }

    const tagsByWorkId = new Map<string, string[]>();
    for (const row of tagMapRows ?? []) {
      const tagLabel = tagLabelById.get(row.tag_id as string);
      if (!tagLabel) continue;
      const bucket = tagsByWorkId.get(row.work_id as string) ?? [];
      bucket.push(tagLabel);
      tagsByWorkId.set(row.work_id as string, bucket);
    }

    for (const work of (works ?? []) as DbCanonicalWorkRow[]) {
      canonicalWorkById.set(work.id, {
        id: work.id,
        title: work.title,
        summary: work.summary,
        releasedOn: work.released_on,
        tags: tagsByWorkId.get(work.id) ?? [],
      });
    }
  }

  return ((projects ?? []) as ProductionProject[]).map((project) => ({
    project,
    canonicalWork: project.work_id ? canonicalWorkById.get(project.work_id) ?? null : null,
    sourceAsset: primaryAssetsByProject.get(project.id) ?? null,
    banners: (bannersByProject.get(project.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

export async function loadRecentProductionProjects(limit = 12): Promise<ProductionProjectSummary[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('production_projects')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return loadProjectSummariesByIds((data ?? []).map((item) => item.id));
}

type EnsureProjectResult = {
  project: ProductionProject;
  banners: ProductionProjectSummary['banners'];
  sourceAsset: ProductionProjectSummary['sourceAsset'];
  createdProject: boolean;
  createdBannerCount: number;
};

type EnsureProjectOptions = {
  overwriteExisting?: boolean;
  workTitle?: string | null;
  workSummary?: string | null;
  releasedOn?: string | null;
  workTags?: string[];
};

type ProjectStorageFile = {
  bucket: string;
  path: string;
};

function getPrimaryEditBanner(
  banners: ProductionProjectSummary['banners'],
): ProductionProjectSummary['banners'][number] | undefined {
  const rolePriority: ProductionProjectBannerRole[] = [
    'portrait_master',
    'landscape_master',
    'instagram_feed',
    'package_cover',
    'imagine_template',
  ];

  for (const role of rolePriority) {
    const match = banners.find((banner) => banner.role === role);
    if (match) {
      return match;
    }
  }

  return banners[0];
}

async function removeProjectStorageFiles(files: ProjectStorageFile[]): Promise<void> {
  if (files.length === 0) {
    return;
  }

  const bucketMap = new Map<string, string[]>();
  for (const file of files) {
    const paths = bucketMap.get(file.bucket) ?? [];
    paths.push(file.path);
    bucketMap.set(file.bucket, paths);
  }

  for (const [bucket, paths] of bucketMap) {
    await removeFilesFromBucket(bucket, paths);
  }
}

async function deleteBannerRecords(params: {
  bannerIds: string[];
  userId: string;
}): Promise<void> {
  if (params.bannerIds.length === 0) {
    return;
  }

  const supabase = await getSupabase();
  const { data: banners, error: bannersError } = await supabase
    .from('banners')
    .select('id, thumbnail_url, fullres_url')
    .in('id', params.bannerIds)
    .eq('user_id', params.userId);

  if (bannersError) {
    throw bannersError;
  }

  const files: ProjectStorageFile[] = [];
  for (const banner of banners ?? []) {
    const thumbnailPath = extractStoragePathFromPublicUrl(
      banner.thumbnail_url ?? '',
      BANNER_ASSET_BUCKET,
    );
    const fullresPath = extractStoragePathFromPublicUrl(
      banner.fullres_url ?? '',
      BANNER_ASSET_BUCKET,
    );

    if (thumbnailPath) {
      files.push({ bucket: BANNER_ASSET_BUCKET, path: thumbnailPath });
    }
    if (fullresPath) {
      files.push({ bucket: BANNER_ASSET_BUCKET, path: fullresPath });
    }
  }

  const { error: deleteError } = await supabase
    .from('banners')
    .delete()
    .in('id', params.bannerIds)
    .eq('user_id', params.userId);

  if (deleteError) {
    throw deleteError;
  }

  try {
    await removeProjectStorageFiles(files);
  } catch (storageError) {
    console.warn('Failed to remove production banner assets:', storageError);
  }
}

async function collectProjectOutputFiles(projectId: string): Promise<ProjectStorageFile[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('production_outputs')
    .select('storage_bucket, storage_path')
    .eq('project_id', projectId);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row): row is { storage_bucket: string; storage_path: string } =>
      Boolean(row.storage_bucket) && Boolean(row.storage_path))
    .map((row) => ({
      bucket: row.storage_bucket,
      path: row.storage_path,
    }));
}

async function resetExistingProductionProject(params: {
  projectId: string;
  asset: DefaultImage;
  userId: string;
}): Promise<void> {
  const supabase = await getSupabase();
  const outputFiles = await collectProjectOutputFiles(params.projectId);

  const { data: bannerLinks, error: bannerLinksError } = await supabase
    .from('production_project_banners')
    .select('banner_id')
    .eq('project_id', params.projectId);

  if (bannerLinksError) {
    throw bannerLinksError;
  }

  const bannerIds = Array.from(new Set((bannerLinks ?? []).map((row) => row.banner_id)));

  await deleteBannerRecords({
    bannerIds,
    userId: params.userId,
  });

  try {
    await removeProjectStorageFiles(outputFiles);
  } catch (storageError) {
    console.warn('Failed to remove production output files during overwrite:', storageError);
  }

  const { error: outputsDeleteError } = await supabase
    .from('production_outputs')
    .delete()
    .eq('project_id', params.projectId);

  if (outputsDeleteError) {
    throw outputsDeleteError;
  }

  const { error: assetsDeleteError } = await supabase
    .from('production_project_assets')
    .delete()
    .eq('project_id', params.projectId);

  if (assetsDeleteError) {
    throw assetsDeleteError;
  }

  const { error: packageUpdateError } = await supabase
    .from('production_delivery_packages')
    .update({
      status: 'draft',
      cover_output_id: null,
      published_at: null,
    })
    .eq('project_id', params.projectId);

  if (packageUpdateError) {
    throw packageUpdateError;
  }

  const { error: projectUpdateError } = await supabase
    .from('production_projects')
    .update({
      status: 'draft',
      title: buildProjectTitle(params.asset),
    })
    .eq('id', params.projectId);

  if (projectUpdateError) {
    throw projectUpdateError;
  }
}

async function createDraftBannersForProject(params: {
  projectId: string;
  asset: DefaultImage;
  userId: string;
}): Promise<{ createdBannerIds: string[]; createdBannerLinkIds: string[]; createdBannerCount: number }> {
  const supabase = await getSupabase();

  for (let index = 0; index < DRAFT_BANNER_SPECS.length; index += 1) {
    await supabase.rpc('increment_display_orders', { p_user_id: params.userId });
  }

  const bannerRows = DRAFT_BANNER_SPECS.map((spec, index) => ({
    user_id: params.userId,
    name: buildBannerName(params.asset, spec.role),
    template: spec.template,
    elements: buildDraftBannerElements(params.asset, spec),
    canvas_color: spec.canvasColor,
    is_public: false,
    display_order: index + 1,
  }));

  const { data: insertedBanners, error: bannersInsertError } = await supabase
    .from('banners')
    .insert(bannerRows)
    .select('id');

  if (bannersInsertError) {
    throw bannersInsertError;
  }

  const createdBannerIds = (insertedBanners ?? []).map((banner) => banner.id);
  const bannerLinks = createdBannerIds.map((bannerId, index) => ({
    project_id: params.projectId,
    banner_id: bannerId,
    role: DRAFT_BANNER_SPECS[index].role,
    sort_order: DRAFT_BANNER_SPECS[index].sortOrder,
    is_active: true,
  }));

  const { data: insertedLinks, error: bannerLinksError } = await supabase
    .from('production_project_banners')
    .insert(bannerLinks)
    .select('id');

  if (bannerLinksError) {
    throw bannerLinksError;
  }

  return {
    createdBannerIds,
    createdBannerLinkIds: (insertedLinks ?? []).map((link) => link.id),
    createdBannerCount: createdBannerIds.length,
  };
}

export async function deleteProductionProject(projectId: string, userId: string): Promise<void> {
  const supabase = await getSupabase();
  const outputFiles = await collectProjectOutputFiles(projectId);

  const { data: bannerLinks, error: bannerLinksError } = await supabase
    .from('production_project_banners')
    .select('banner_id')
    .eq('project_id', projectId);

  if (bannerLinksError) {
    throw bannerLinksError;
  }

  const bannerIds = Array.from(new Set((bannerLinks ?? []).map((row) => row.banner_id)));

  await deleteBannerRecords({
    bannerIds,
    userId,
  });

  try {
    await removeProjectStorageFiles(outputFiles);
  } catch (storageError) {
    console.warn('Failed to remove production output files during delete:', storageError);
  }

  const { error: deleteProjectError } = await supabase
    .from('production_projects')
    .delete()
    .eq('id', projectId);

  if (deleteProjectError) {
    throw deleteProjectError;
  }
}

export async function ensureProductionProjectFromAsset(
  asset: DefaultImage,
  userId: string,
  options: EnsureProjectOptions = {},
): Promise<EnsureProjectResult> {
  if (!asset.work_series_slug || !asset.work_number) {
    throw new Error('This asset is missing work metadata.');
  }

  const supabase = await getSupabase();
  const workDisplayCode = formatWorkDisplayCode(asset.work_number);
  const variantNumber = asset.variant_number ?? 1;
  const title = buildProjectTitle(asset);
  const canonical = await ensureCanonicalWorkVariant({
    workSeriesSlug: asset.work_series_slug,
    workNumber: asset.work_number,
    variantNumber,
    workTitle: options.workTitle,
    workSummary: options.workSummary,
    releasedOn: options.releasedOn,
    workTags: options.workTags,
  });

  const { data: existingProject, error: existingProjectError } = await supabase
    .from('production_projects')
    .select('*')
    .eq('project_type', 'variant_pack')
    .eq('work_series_slug', asset.work_series_slug)
    .eq('work_number', asset.work_number)
    .eq('variant_number', variantNumber)
    .maybeSingle();

  if (existingProjectError) {
    throw existingProjectError;
  }

  let project = existingProject as ProductionProject | null;
  let createdProject = false;
  const createdBannerIds: string[] = [];
  const createdBannerLinkIds: string[] = [];
  let insertedProjectId: string | null = null;
  let createdBannerCount = 0;

  try {
    if (!project) {
      const { data: insertedProject, error: insertProjectError } = await supabase
        .from('production_projects')
        .insert({
          project_type: 'variant_pack',
          work_series_slug: asset.work_series_slug,
          work_number: asset.work_number,
          work_display_code: workDisplayCode,
          variant_number: variantNumber,
          work_id: canonical.workId,
          variant_id: canonical.variantId,
          work_title: normalizeProjectText(options.workTitle),
          work_summary: normalizeProjectText(options.workSummary),
          released_on: normalizeProjectText(options.releasedOn),
          work_tags: options.workTags ?? null,
          status: 'draft',
          title,
          created_by: userId,
        })
        .select('*')
        .single();

      if (insertProjectError) {
        throw insertProjectError;
      }

      project = insertedProject as ProductionProject;
      insertedProjectId = project.id;
      createdProject = true;

      const { error: packageError } = await supabase
        .from('production_delivery_packages')
        .insert({
          project_id: project.id,
          status: 'draft',
        });

      if (packageError) {
        throw packageError;
      }
    } else if (!options.overwriteExisting) {
      if (project.work_id !== canonical.workId || project.variant_id !== canonical.variantId) {
        const { error: relinkError } = await supabase
          .from('production_projects')
          .update({
            work_id: canonical.workId,
            variant_id: canonical.variantId,
            work_title: normalizeProjectText(options.workTitle) ?? project.work_title,
            work_summary:
              options.workSummary !== undefined ? normalizeProjectText(options.workSummary) : project.work_summary,
            released_on:
              options.releasedOn !== undefined ? normalizeProjectText(options.releasedOn) : project.released_on,
            work_tags: options.workTags ?? project.work_tags,
          })
          .eq('id', project.id);

        if (relinkError) {
          throw relinkError;
        }

        project = {
          ...project,
          work_id: canonical.workId,
          variant_id: canonical.variantId,
          work_title: normalizeProjectText(options.workTitle) ?? project.work_title,
          work_summary:
            options.workSummary !== undefined ? normalizeProjectText(options.workSummary) : project.work_summary,
          released_on:
            options.releasedOn !== undefined ? normalizeProjectText(options.releasedOn) : project.released_on,
          work_tags: options.workTags ?? project.work_tags,
        };
      }

      const [summary] = await loadProjectSummariesByIds([project.id]);
      return {
        project,
        banners: summary?.banners ?? [],
        sourceAsset: summary?.sourceAsset ?? null,
        createdProject: false,
        createdBannerCount: 0,
      };
    } else if (options.overwriteExisting) {
      await resetExistingProductionProject({
        projectId: project.id,
        asset,
        userId,
      });

      const { error: relinkError } = await supabase
        .from('production_projects')
        .update({
          work_id: canonical.workId,
          variant_id: canonical.variantId,
          work_title:
            options.workTitle !== undefined ? normalizeProjectText(options.workTitle) : project.work_title,
          work_summary:
            options.workSummary !== undefined ? normalizeProjectText(options.workSummary) : project.work_summary,
          released_on:
            options.releasedOn !== undefined ? normalizeProjectText(options.releasedOn) : project.released_on,
          work_tags: options.workTags ?? project.work_tags,
          title,
        })
        .eq('id', project.id);

      if (relinkError) {
        throw relinkError;
      }

      project = {
        ...project,
        work_id: canonical.workId,
        variant_id: canonical.variantId,
        work_title:
          options.workTitle !== undefined ? normalizeProjectText(options.workTitle) : project.work_title,
        work_summary:
          options.workSummary !== undefined ? normalizeProjectText(options.workSummary) : project.work_summary,
        released_on:
          options.releasedOn !== undefined ? normalizeProjectText(options.releasedOn) : project.released_on,
        work_tags: options.workTags ?? project.work_tags,
        title,
      };
    }

    const { error: assetInsertError } = await supabase
      .from('production_project_assets')
      .insert({
        project_id: project.id,
        default_image_id: asset.id,
        role: 'source',
        sort_order: 0,
        is_primary: true,
      });

    if (assetInsertError) {
      throw assetInsertError;
    }

    const createdDrafts = await createDraftBannersForProject({
      projectId: project.id,
      asset,
      userId,
    });
    createdBannerCount = createdDrafts.createdBannerCount;
    createdBannerIds.push(...createdDrafts.createdBannerIds);
    createdBannerLinkIds.push(...createdDrafts.createdBannerLinkIds);

    const [summary] = await loadProjectSummariesByIds([project.id]);
    return {
      project,
      banners: summary?.banners ?? [],
      sourceAsset: summary?.sourceAsset ?? null,
      createdProject,
      createdBannerCount,
    };
  } catch (error) {
    if (createdBannerLinkIds.length > 0) {
      await supabase.from('production_project_banners').delete().in('id', createdBannerLinkIds);
    }

    if (createdBannerIds.length > 0) {
      await supabase.from('banners').delete().in('id', createdBannerIds).eq('user_id', userId);
    }

    if (insertedProjectId) {
      await supabase.from('production_projects').delete().eq('id', insertedProjectId);
    }

    throw error;
  }
}

export { getPrimaryEditBanner };

export async function updateProductionProjectWorkMetadata(params: {
  projectId: string;
  workTitle: string;
  workSummary: string;
  releasedOn: string;
  workTags: string[];
}): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('production_projects')
    .update({
      work_title: normalizeProjectText(params.workTitle),
      work_summary: normalizeProjectText(params.workSummary),
      released_on: normalizeProjectText(params.releasedOn),
      work_tags: params.workTags,
    })
    .eq('id', params.projectId);

  if (error) {
    throw error;
  }
}
