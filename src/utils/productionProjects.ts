import { getSupabase, getSupabaseStoragePublicUrl } from './supabase';
import type { DefaultImage } from '../types/image-library';
import type { ImageElement, Template } from '../types/template';
import type {
  ProductionBannerSummary,
  ProductionProject,
  ProductionProjectBannerLink,
  ProductionProjectBannerRole,
  ProductionProjectSummary,
} from '../types/production-project';
import { formatSeriesLabel, formatWorkDisplayCode } from './libraryAssets';

type DraftBannerSpec = {
  role: Exclude<ProductionProjectBannerRole, 'imagine_template'>;
  sortOrder: number;
  template: Template;
  canvasColor: string;
  verticalBias: number;
};

const DRAFT_BANNER_SPECS: DraftBannerSpec[] = [
  {
    role: 'portrait_master',
    sortOrder: 1,
    template: {
      id: 'factory-portrait-master',
      name: 'Portrait Master',
      width: 1440,
      height: 2560,
      backgroundColor: '#F7F2EB',
    },
    canvasColor: '#F7F2EB',
    verticalBias: 0.58,
  },
  {
    role: 'landscape_master',
    sortOrder: 2,
    template: {
      id: 'factory-landscape-master',
      name: 'Landscape Master',
      width: 2560,
      height: 1440,
      backgroundColor: '#F3ECE1',
    },
    canvasColor: '#F3ECE1',
    verticalBias: 0.57,
  },
  {
    role: 'instagram_feed',
    sortOrder: 3,
    template: {
      id: 'factory-instagram-feed',
      name: 'Instagram Feed',
      width: 1080,
      height: 1350,
      backgroundColor: '#F8F3EC',
    },
    canvasColor: '#F8F3EC',
    verticalBias: 0.6,
  },
  {
    role: 'package_cover',
    sortOrder: 4,
    template: {
      id: 'factory-package-cover',
      name: 'Package Cover',
      width: 1600,
      height: 1600,
      backgroundColor: '#F4EEE5',
    },
    canvasColor: '#F4EEE5',
    verticalBias: 0.57,
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

const ROLE_LABELS: Record<Exclude<ProductionProjectBannerRole, 'imagine_template'>, string> = {
  portrait_master: 'Portrait Master',
  landscape_master: 'Landscape Master',
  instagram_feed: 'Instagram Feed',
  package_cover: 'Package Cover',
};

function getAssetDimensions(asset: DefaultImage): { width: number; height: number } {
  const width = asset.width && asset.width > 0 ? asset.width : 1200;
  const height = asset.height && asset.height > 0 ? asset.height : 1600;
  return { width, height };
}

function buildCenteredImageElement(asset: DefaultImage, spec: DraftBannerSpec): ImageElement {
  const src = getSupabaseStoragePublicUrl('default-images', asset.storage_path);
  const { width: sourceWidth, height: sourceHeight } = getAssetDimensions(asset);
  const maxWidth = spec.template.width * 0.76;
  const maxHeight = spec.template.height * 0.76;
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = Math.max(160, Math.round(sourceWidth * scale));
  const height = Math.max(160, Math.round(sourceHeight * scale));
  const x = Math.round((spec.template.width - width) / 2);
  const centeredY = spec.template.height * spec.verticalBias - height / 2;
  const minY = spec.template.height * 0.08;
  const maxY = spec.template.height - height - spec.template.height * 0.06;
  const y = Math.round(Math.max(minY, Math.min(maxY, centeredY)));

  return {
    id: `image-${spec.role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    src,
    x,
    y,
    width,
    height,
    visible: true,
    opacity: 1,
  };
}

function buildProjectTitle(asset: DefaultImage): string {
  const seriesLabel = formatSeriesLabel(asset.work_series_slug ?? 'episode');
  const workCode = formatWorkDisplayCode(asset.work_number ?? 0);
  const variantNumber = asset.variant_number ?? 1;
  return `${seriesLabel} ${workCode}-${variantNumber}`;
}

function buildBannerName(asset: DefaultImage, role: DraftBannerSpec['role']): string {
  return `${buildProjectTitle(asset)} ${ROLE_LABELS[role]}`;
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

  const assetMap = new Map<string, { id: string; name: string; storage_path: string }>();
  if (assetIds.length > 0) {
    const { data: assets, error: assetsError } = await supabase
      .from('default_images')
      .select('id, name, storage_path')
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
      thumbnailUrl: banner.thumbnail_url,
      width: banner.template?.width,
      height: banner.template?.height,
    });
    bannersByProject.set(link.project_id, projectBannersForProject);
  }

  const primaryAssetsByProject = new Map<string, { id: string; name: string; storage_path: string } | null>();
  for (const link of (projectAssets ?? []) as DbAssetLink[]) {
    const existing = primaryAssetsByProject.get(link.project_id);
    if (existing) {
      continue;
    }

    const asset = assetMap.get(link.default_image_id);
    primaryAssetsByProject.set(link.project_id, asset ?? null);
  }

  return ((projects ?? []) as ProductionProject[]).map((project) => ({
    project,
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

export async function ensureProductionProjectFromAsset(
  asset: DefaultImage,
  userId: string,
): Promise<EnsureProjectResult> {
  if (!asset.work_series_slug || !asset.work_number) {
    throw new Error('This asset is missing work metadata.');
  }

  const supabase = await getSupabase();
  const workDisplayCode = formatWorkDisplayCode(asset.work_number);
  const variantNumber = asset.variant_number ?? 1;
  const title = buildProjectTitle(asset);

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
    }

    const { data: existingAssetLinks, error: existingAssetLinksError } = await supabase
      .from('production_project_assets')
      .select('id, default_image_id, is_primary')
      .eq('project_id', project.id)
      .eq('role', 'source')
      .order('sort_order', { ascending: true });

    if (existingAssetLinksError) {
      throw existingAssetLinksError;
    }

    const hasSameAssetLink = (existingAssetLinks ?? []).some((link) => link.default_image_id === asset.id);
    const hasPrimarySource = (existingAssetLinks ?? []).some((link) => link.is_primary);

    if (!hasSameAssetLink) {
      const { error: assetInsertError } = await supabase
        .from('production_project_assets')
        .insert({
          project_id: project.id,
          default_image_id: asset.id,
          role: 'source',
          sort_order: existingAssetLinks?.length ?? 0,
          is_primary: !hasPrimarySource,
        });

      if (assetInsertError) {
        throw assetInsertError;
      }
    }

    const { data: existingBannerLinks, error: existingBannerLinksError } = await supabase
      .from('production_project_banners')
      .select('*')
      .eq('project_id', project.id)
      .eq('is_active', true);

    if (existingBannerLinksError) {
      throw existingBannerLinksError;
    }

    const existingRoles = new Set((existingBannerLinks ?? []).map((row) => row.role));
    const missingSpecs = DRAFT_BANNER_SPECS.filter((spec) => !existingRoles.has(spec.role));

    if (missingSpecs.length > 0) {
      for (let index = 0; index < missingSpecs.length; index += 1) {
        await supabase.rpc('increment_display_orders', { p_user_id: userId });
      }

      const bannerRows = missingSpecs.map((spec, index) => ({
        user_id: userId,
        name: buildBannerName(asset, spec.role),
        template: spec.template,
        elements: [buildCenteredImageElement(asset, spec)],
        canvas_color: spec.canvasColor,
        is_public: false,
        display_order: index + 1,
      }));

      const { data: insertedBanners, error: bannersInsertError } = await supabase
        .from('banners')
        .insert(bannerRows)
        .select('id, name');

      if (bannersInsertError) {
        throw bannersInsertError;
      }

      const banners = insertedBanners ?? [];
      createdBannerCount = banners.length;
      for (const banner of banners) {
        createdBannerIds.push(banner.id);
      }

      const bannerLinks = banners.map((banner, index) => ({
        project_id: project!.id,
        banner_id: banner.id,
        role: missingSpecs[index].role,
        sort_order: missingSpecs[index].sortOrder,
        is_active: true,
      }));

      const { data: insertedLinks, error: bannerLinksError } = await supabase
        .from('production_project_banners')
        .insert(bannerLinks)
        .select('id');

      if (bannerLinksError) {
        throw bannerLinksError;
      }

      for (const link of insertedLinks ?? []) {
        createdBannerLinkIds.push(link.id);
      }
    }

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
