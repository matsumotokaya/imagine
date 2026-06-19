import { getSupabase } from './supabase';
import { removeFilesFromBucket, uploadBlobToBucket } from './storage';
import {
  COVER_SIZE,
  MOCK_PUBLIC_PATH,
  ensureCoverFontsReady,
  loadImageElement,
  renderCover,
} from './coverComposer';
import { syncGalleryWorkFromProductionProject } from './gallerySync';
import type {
  ProductionOutputRole,
  ProductionProjectStatus,
  ProductionProjectSummary,
} from '../types/production-project';

const OUTPUT_BUCKET = 'user-images';

type OutputSpec = {
  role: Exclude<ProductionOutputRole, 'zip'>;
  sourceRole: ProductionProjectSummary['banners'][number]['role'];
  width: number;
  height: number;
  fileName: string;
};

const OUTPUT_SPECS: OutputSpec[] = [
  {
    role: 'mobile_qhd',
    sourceRole: 'portrait_master',
    width: 1440,
    height: 2560,
    fileName: 'mobile-qhd.png',
  },
  {
    role: 'mobile_hd',
    sourceRole: 'portrait_master',
    width: 1080,
    height: 1920,
    fileName: 'mobile-hd.png',
  },
  {
    role: 'pc_qhd',
    sourceRole: 'landscape_master',
    width: 2560,
    height: 1440,
    fileName: 'pc-qhd.png',
  },
  {
    role: 'pc_hd',
    sourceRole: 'landscape_master',
    width: 1920,
    height: 1080,
    fileName: 'pc-hd.png',
  },
  {
    role: 'instagram_feed',
    sourceRole: 'instagram_feed',
    width: 1080,
    height: 1350,
    fileName: 'instagram-feed.png',
  },
];

// The package cover is generated headlessly from the mobile_hd wallpaper
// (see coverComposer), not from an editable draft banner.
const COVER_OUTPUT = {
  width: 1600,
  height: 1600,
  fileName: 'package-cover.png',
};

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to export PNG blob.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

async function renderOutputBlob(sourceUrl: string, width: number, height: number): Promise<Blob> {
  const image = await loadImageFromUrl(sourceUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to get 2D canvas context.');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvasToPngBlob(canvas);
}

async function renderCoverBlob(wallpaperBlob: Blob, episodeCode: string): Promise<Blob> {
  const wallpaperUrl = URL.createObjectURL(wallpaperBlob);
  try {
    const [wallpaper, mock] = await Promise.all([
      loadImageElement(wallpaperUrl),
      loadImageElement(MOCK_PUBLIC_PATH),
    ]);
    await ensureCoverFontsReady();

    const canvas = document.createElement('canvas');
    canvas.width = COVER_SIZE;
    canvas.height = COVER_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D canvas context for cover.');
    }

    renderCover(context, { wallpaper, mock, episodeCode });
    return canvasToPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(wallpaperUrl);
  }
}

async function updateProjectStatus(projectId: string, status: ProductionProjectStatus): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('production_projects')
    .update({ status })
    .eq('id', projectId);

  if (error) {
    throw error;
  }
}

async function upsertDeliveryPackage(params: {
  projectId: string;
  status: 'draft' | 'preparing' | 'ready' | 'published' | 'archived';
  coverOutputId?: string | null;
  publishedAt?: string | null;
}): Promise<void> {
  const supabase = await getSupabase();

  const { data: existingPackage, error: selectError } = await supabase
    .from('production_delivery_packages')
    .select('id')
    .eq('project_id', params.projectId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const payload = {
    project_id: params.projectId,
    status: params.status,
    cover_output_id: params.coverOutputId ?? null,
    published_at: params.publishedAt ?? null,
  };

  if (existingPackage?.id) {
    const { error } = await supabase
      .from('production_delivery_packages')
      .update(payload)
      .eq('id', existingPackage.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase
    .from('production_delivery_packages')
    .insert(payload);

  if (error) {
    throw error;
  }
}

async function saveCurrentOutput(params: {
  userId: string;
  projectId: string;
  sourceBannerId: string;
  role: Exclude<ProductionOutputRole, 'zip'>;
  width: number;
  height: number;
  blob: Blob;
  fileName: string;
}): Promise<{ id: string }> {
  const supabase = await getSupabase();
  const { data: currentOutputs, error: currentOutputsError } = await supabase
    .from('production_outputs')
    .select('id, storage_path')
    .eq('project_id', params.projectId)
    .eq('role', params.role)
    .eq('is_current', true);

  if (currentOutputsError) {
    throw currentOutputsError;
  }

  // Production outputs use fixed file names (mobile-qhd.png, etc.) and overwrite
  // in place via upsert. This depends on TWO storage RLS policies on the
  // user-images bucket, both keyed on "first path segment == auth.uid()":
  //   - INSERT: for the first publish of a project
  //   - UPDATE: for re-publishing (overwriting) an already-published project
  // If the UPDATE policy is missing, re-publish fails with a row-level security
  // violation even though the first publish succeeded. Keep both policies in sync.
  const filePath = `${params.userId}/production/${params.projectId}/${params.fileName}`;
  const publicUrl = await uploadBlobToBucket(
    OUTPUT_BUCKET,
    filePath,
    params.blob,
    'image/png',
    { upsert: true },
  );

  const { error: deactivateError } = await supabase
    .from('production_outputs')
    .update({ is_current: false })
    .eq('project_id', params.projectId)
    .eq('role', params.role)
    .eq('is_current', true);

  if (deactivateError) {
    throw deactivateError;
  }

  const { data: insertedOutput, error: insertError } = await supabase
    .from('production_outputs')
    .insert({
      project_id: params.projectId,
      source_banner_id: params.sourceBannerId,
      role: params.role,
      storage_provider: 'supabase',
      storage_bucket: OUTPUT_BUCKET,
      storage_path: filePath,
      mime_type: 'image/png',
      file_size_bytes: params.blob.size,
      width: params.width,
      height: params.height,
      status: 'ready',
      is_current: true,
    })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  const stalePaths = (currentOutputs ?? [])
    .map((output) => output.storage_path)
    .filter((path): path is string => Boolean(path) && path !== filePath);

  if (stalePaths.length > 0) {
    try {
      await removeFilesFromBucket(OUTPUT_BUCKET, stalePaths);
    } catch (storageError) {
      console.warn('Failed to remove stale production outputs:', storageError, publicUrl);
    }
  }

  return insertedOutput;
}

export async function buildProductionOutputs(project: ProductionProjectSummary): Promise<{ outputCount: number }> {
  const supabase = await getSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('You must be signed in to build production outputs.');
  }
  const userId = authData.user.id;

  await updateProjectStatus(project.project.id, 'in_progress');
  await upsertDeliveryPackage({
    projectId: project.project.id,
    status: 'preparing',
  });

  let coverOutputId: string | null = null;

  try {
    let outputCount = 0;
    let mobileHdBlob: Blob | null = null;

    for (const spec of OUTPUT_SPECS) {
      const sourceBanner = project.banners.find((banner) => banner.role === spec.sourceRole);
      if (!sourceBanner?.fullresUrl) {
        throw new Error(`Missing full-resolution source for ${spec.sourceRole}. Open the draft, save it, then try again.`);
      }

      const blob = await renderOutputBlob(sourceBanner.fullresUrl, spec.width, spec.height);
      await saveCurrentOutput({
        userId,
        projectId: project.project.id,
        sourceBannerId: sourceBanner.bannerId,
        role: spec.role,
        width: spec.width,
        height: spec.height,
        blob,
        fileName: spec.fileName,
      });

      if (spec.role === 'mobile_hd') {
        mobileHdBlob = blob;
      }

      outputCount += 1;
    }

    // Generate the package cover headlessly from the HD wallpaper.
    const portraitBanner = project.banners.find((banner) => banner.role === 'portrait_master');
    if (mobileHdBlob && portraitBanner) {
      const episodeCode = `#${project.project.work_display_code}`;
      const coverBlob = await renderCoverBlob(mobileHdBlob, episodeCode);
      const savedCover = await saveCurrentOutput({
        userId,
        projectId: project.project.id,
        sourceBannerId: portraitBanner.bannerId,
        role: 'package_cover',
        width: COVER_OUTPUT.width,
        height: COVER_OUTPUT.height,
        blob: coverBlob,
        fileName: COVER_OUTPUT.fileName,
      });
      coverOutputId = savedCover.id;
      outputCount += 1;
    }

    await upsertDeliveryPackage({
      projectId: project.project.id,
      status: 'ready',
      coverOutputId,
    });
    await updateProjectStatus(project.project.id, 'ready');

    return { outputCount };
  } catch (error) {
    await upsertDeliveryPackage({
      projectId: project.project.id,
      status: 'draft',
    });
    await updateProjectStatus(project.project.id, project.project.status);
    throw error;
  }
}

export async function publishProductionProject(project: ProductionProjectSummary): Promise<void> {
  const publishedAt = new Date().toISOString();
  await syncGalleryWorkFromProductionProject(project);

  await upsertDeliveryPackage({
    projectId: project.project.id,
    status: 'published',
    publishedAt,
  });
  await updateProjectStatus(project.project.id, 'published');
}
