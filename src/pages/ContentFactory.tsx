import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SitePageLayout } from '../components/SitePageLayout';
import { getSupabase } from '../utils/supabase';
import { isR2Configured, resolveAssetUrl, toR2Key } from '../utils/assetUrl';
import { uploadBlobToR2 } from '../utils/r2Upload';
import { extractStoragePathFromPublicUrl, getExtensionFromMime, uploadFileToBucket } from '../utils/storage';
import { generateImageThumbnail } from '../utils/imageThumbnail';
import {
  formatSeriesLabel,
  formatWorkDisplayCode,
  formatWorkVariantLabel,
  insertDefaultImageRecord,
  OFFICIAL_ASSET_ROLE_OPTIONS,
  parseTagInput,
  WORK_SERIES_OPTIONS,
  type WorkSeriesSlug,
} from '../utils/libraryAssets';
import { ensureCanonicalWorkVariant } from '../utils/canonicalWorks';
import type { DefaultImage } from '../types/image-library';
import type { ProductionProjectSummary } from '../types/production-project';
import { invalidateBannerCollectionQueries } from '../hooks/useBanners';
import { invalidateProductionProjectQueries } from '../hooks/useProductionProjects';
import { ensureProductionProjectFromAsset, loadRecentProductionProjects } from '../utils/productionProjects';

type FactoryStatus = 'live' | 'manual' | 'planned';

type WorkflowStep = {
  name: string;
  status: FactoryStatus;
  summary: string;
  detail: string;
};

const workflowSteps: WorkflowStep[] = [
  {
    name: 'Work Variant Select',
    status: 'planned',
    summary: 'episode / reel / remix と variant を選択',
    detail: 'Gallery 側の works / variants と 1:1 で結びつく selector を追加予定。',
  },
  {
    name: 'Character Asset Upload',
    status: 'live',
    summary: '切り抜き PNG を作品 metadata 付きで登録',
    detail: 'Content Factory から `series / work_number / variant_number / asset_role` を付与して `default_images` に保存する。',
  },
  {
    name: 'Portrait Master',
    status: 'manual',
    summary: 'mobile QHD の正本を editor で調整',
    detail: '1440 x 2560 を正本として保持し、feed と mobile HD の起点にする。',
  },
  {
    name: 'Landscape Master',
    status: 'manual',
    summary: 'PC QHD の正本を editor で調整',
    detail: '2560 x 1440 を正本として保持し、PC HD を派生生成する前提。',
  },
  {
    name: 'Derived Outputs',
    status: 'live',
    summary: 'Publish で HD / QHD / feed を書き出し',
    detail: 'portrait / landscape / feed master から mobile HD・QHD、PC HD・QHD、feed を Publish 時に build する。',
  },
  {
    name: 'Cover Compose',
    status: 'live',
    summary: 'HD 壁紙から Cover を自動合成',
    detail: 'mobile HD 壁紙を iPhone モックに合成し、1600 x 1600 の package cover を Publish 時にヘッドレス生成する。',
  },
  {
    name: 'Package Assembly',
    status: 'live',
    summary: 'cover と 5 種書き出しを 1 パッケージ化',
    detail: 'mobile HD/QHD, PC HD/QHD, feed, cover を production_outputs と delivery package にまとめ、ready 状態にする。',
  },
  {
    name: 'Template Promotion',
    status: 'live',
    summary: 'admin が banner を公開 template に昇格',
    detail: '一般向けのラインナップ化は既存の template 化フローに寄せる。',
  },
  {
    name: 'Gallery Publish',
    status: 'planned',
    summary: 'Gallery の work offer と delivery に接続',
    detail: '壁紙販売・サブスク提供・準備中ステータスを works 側へ反映する。',
  },
];

const outputSpecs = [
  { label: 'Mobile QHD', size: '1440 x 2560', role: 'Portrait master / PNG' },
  { label: 'Mobile HD', size: '1080 x 1920', role: 'Portrait derive / PNG' },
  { label: 'PC QHD', size: '2560 x 1440', role: 'Landscape master / PNG' },
  { label: 'PC HD', size: '1920 x 1080', role: 'Landscape derive / PNG' },
  { label: 'Instagram Feed', size: '1080 x 1350', role: 'Portrait crop / PNG or JPEG' },
  { label: 'Package Cover', size: '1600 x 1600', role: 'Store listing / product jacket' },
];

const implementationPhases = [
  {
    title: 'Phase 1',
    summary: 'admin UI と運用ルールを固定',
    items: [
      'Content Factory を admin menu から常設導線化',
      'portrait / landscape master を前提に制作フローを統一',
      '通常保存と heavy output build を分離する方針を固定',
    ],
  },
  {
    title: 'Phase 2',
    summary: 'production tables と output storage を追加',
    items: [
      '公式素材、production project、derived output の各テーブルを作る',
      'PNG delivery を user banner 保存とは別ストレージで管理する',
      'build 状態と publish 状態を admin から見えるようにする',
    ],
  },
  {
    title: 'Phase 3',
    summary: 'Gallery / wallpaper delivery と接続',
    items: [
      'work variant ごとの wallpaper offer を works 側へ反映',
      '購入者・会員向けの delivery URL を発行',
      '準備中、公開中、要リクエストの状態を統一表示',
    ],
  },
];

const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type TagHistoryRow = {
  tags: string[] | null;
  usedAt: string | null;
};

type TagSuggestionSet = {
  recommended: string | null;
  recent: string[];
  popular: string[];
  history: string[];
};

function getTodayDateInputValue(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function buildDefaultWorkTitle(seriesSlug: WorkSeriesSlug, workNumber: number): string {
  return `${formatSeriesLabel(seriesSlug).toUpperCase()} ${formatWorkDisplayCode(workNumber)}`;
}

function appendTagToInput(currentValue: string, tag: string): string {
  const normalizedTag = tag.trim();
  if (!normalizedTag) {
    return currentValue;
  }

  const currentTags = parseTagInput(currentValue);
  const existing = new Set(currentTags.map((value) => value.toLowerCase()));
  if (existing.has(normalizedTag.toLowerCase())) {
    return currentTags.join(', ');
  }

  return [...currentTags, normalizedTag].join(', ');
}

function buildTagSuggestionSet(rows: TagHistoryRow[]): TagSuggestionSet {
  const stats = new Map<string, { label: string; count: number; lastUsedAt: string | null }>();

  for (const row of rows) {
    for (const rawTag of row.tags ?? []) {
      const label = rawTag.trim();
      if (!label) {
        continue;
      }

      const key = label.toLowerCase();
      const existing = stats.get(key);

      if (!existing) {
        stats.set(key, {
          label,
          count: 1,
          lastUsedAt: row.usedAt,
        });
        continue;
      }

      existing.count += 1;
      if (!existing.lastUsedAt || (row.usedAt && row.usedAt > existing.lastUsedAt)) {
        existing.lastUsedAt = row.usedAt;
        existing.label = label;
      }
    }
  }

  const entries = Array.from(stats.values());
  const recent = entries
    .slice()
    .sort((a, b) => {
      if (a.lastUsedAt === b.lastUsedAt) {
        return b.count - a.count;
      }
      if (!a.lastUsedAt) {
        return 1;
      }
      if (!b.lastUsedAt) {
        return -1;
      }
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    })
    .map((entry) => entry.label);
  const popular = entries
    .slice()
    .sort((a, b) => {
      if (a.count === b.count) {
        if (!a.lastUsedAt) {
          return 1;
        }
        if (!b.lastUsedAt) {
          return -1;
        }
        return b.lastUsedAt.localeCompare(a.lastUsedAt);
      }
      return b.count - a.count;
    })
    .map((entry) => entry.label);

  const history = Array.from(new Set([...recent, ...popular]));

  return {
    recommended: recent[0] ?? popular[0] ?? null,
    recent: recent.slice(0, 6),
    popular: popular.slice(0, 6),
    history: history.slice(0, 12),
  };
}

function statusClasses(status: FactoryStatus): string {
  if (status === 'live') {
    return 'bg-green-100 text-green-800 border-green-200';
  }
  if (status === 'manual') {
    return 'bg-amber-100 text-amber-800 border-amber-200';
  }
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function statusLabel(status: FactoryStatus): string {
  if (status === 'live') {
    return 'Live';
  }
  if (status === 'manual') {
    return 'Manual';
  }
  return 'Planned';
}

export function ContentFactory() {
  const { user, profile, loading } = useAuth();
  const queryClient = useQueryClient();
  const todayDefault = useMemo(() => getTodayDateInputValue(), []);
  const [officialAssets, setOfficialAssets] = useState<DefaultImage[]>([]);
  const [recentProjects, setRecentProjects] = useState<ProductionProjectSummary[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [creatingProjectAssetId, setCreatingProjectAssetId] = useState<string | null>(null);
  const [seriesSlug, setSeriesSlug] = useState<WorkSeriesSlug>('episode');
  const [workNumber, setWorkNumber] = useState('1');
  const [variantNumber, setVariantNumber] = useState('1');
  const [workTitle, setWorkTitle] = useState(() => buildDefaultWorkTitle('episode', 1));
  const [releasedOn, setReleasedOn] = useState(() => todayDefault);
  const [workSummary, setWorkSummary] = useState('');
  const [workTagInput, setWorkTagInput] = useState('');
  const [assetRole, setAssetRole] = useState<(typeof OFFICIAL_ASSET_ROLE_OPTIONS)[number]['value']>('character_cutout');
  const [assetTagInput, setAssetTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [workTagSuggestions, setWorkTagSuggestions] = useState<TagSuggestionSet>({
    recommended: null,
    recent: [],
    popular: [],
    history: [],
  });
  const [assetTagSuggestions, setAssetTagSuggestions] = useState<TagSuggestionSet>({
    recommended: null,
    recent: [],
    popular: [],
    history: [],
  });
  const lastAutoWorkTitleRef = useRef(buildDefaultWorkTitle('episode', 1));
  const lastAutoWorkTagRef = useRef<string | null>(null);
  const lastAutoAssetTagRef = useRef<string | null>(null);

  const recentProjectMap = useMemo(() => {
    const map = new Map<string, ProductionProjectSummary>();
    for (const entry of recentProjects) {
      const key = `${entry.project.work_series_slug}:${entry.project.work_number}:${entry.project.variant_number}`;
      map.set(key, entry);
    }
    return map;
  }, [recentProjects]);

  const loadOfficialAssets = async () => {
    setAssetsLoading(true);
    setAssetsError(null);

    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('default_images')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) {
        throw error;
      }

      setOfficialAssets((data ?? []) as DefaultImage[]);
    } catch (error) {
      console.error('Failed to load official assets:', error);
      setAssetsError(error instanceof Error ? error.message : 'Failed to load official assets.');
    } finally {
      setAssetsLoading(false);
    }
  };

  const loadProjects = async () => {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const data = await loadRecentProductionProjects(12);
      setRecentProjects(data);
    } catch (error) {
      console.error('Failed to load production projects:', error);
      setProjectsError(error instanceof Error ? error.message : 'Failed to load production projects.');
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadTagSuggestions = async () => {
    try {
      const supabase = await getSupabase();
      const [{ data: workRows, error: workError }, { data: assetRows, error: assetError }] = await Promise.all([
        supabase
          .from('production_projects')
          .select('work_tags, updated_at')
          .order('updated_at', { ascending: false })
          .limit(120),
        supabase
          .from('default_images')
          .select('tags, created_at')
          .order('created_at', { ascending: false })
          .limit(120),
      ]);

      if (workError) {
        throw workError;
      }
      if (assetError) {
        throw assetError;
      }

      const workHistoryRows: TagHistoryRow[] = (workRows ?? []).map((row) => ({
        tags: row.work_tags as string[] | null,
        usedAt: row.updated_at as string | null,
      }));
      const assetHistoryRows: TagHistoryRow[] = (assetRows ?? []).map((row) => ({
        tags: row.tags as string[] | null,
        usedAt: row.created_at as string | null,
      }));

      setWorkTagSuggestions(buildTagSuggestionSet(workHistoryRows));
      setAssetTagSuggestions(buildTagSuggestionSet(assetHistoryRows));
    } catch (error) {
      console.error('Failed to load tag suggestions:', error);
    }
  };

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      return;
    }

    void loadOfficialAssets();
    void loadProjects();
    void loadTagSuggestions();
  }, [profile?.role, user]);

  useEffect(() => {
    const parsedWorkNumber = Number(workNumber);
    const nextAutoTitle = buildDefaultWorkTitle(
      seriesSlug,
      Number.isInteger(parsedWorkNumber) && parsedWorkNumber > 0 ? parsedWorkNumber : 0,
    );

    setWorkTitle((current) => {
      const trimmed = current.trim();
      if (!trimmed || current === lastAutoWorkTitleRef.current) {
        return nextAutoTitle;
      }
      return current;
    });
    lastAutoWorkTitleRef.current = nextAutoTitle;
  }, [seriesSlug, workNumber]);

  useEffect(() => {
    setReleasedOn((current) => current.trim() || todayDefault);
  }, [todayDefault]);

  useEffect(() => {
    if (!workTagSuggestions.recommended) {
      return;
    }

    setWorkTagInput((current) => {
      const trimmed = current.trim();
      if (!trimmed || trimmed === (lastAutoWorkTagRef.current ?? '')) {
        return workTagSuggestions.recommended ?? '';
      }
      return current;
    });
    lastAutoWorkTagRef.current = workTagSuggestions.recommended;
  }, [workTagSuggestions.recommended]);

  useEffect(() => {
    if (!assetTagSuggestions.recommended) {
      return;
    }

    setAssetTagInput((current) => {
      const trimmed = current.trim();
      if (!trimmed || trimmed === (lastAutoAssetTagRef.current ?? '')) {
        return assetTagSuggestions.recommended ?? '';
      }
      return current;
    });
    lastAutoAssetTagRef.current = assetTagSuggestions.recommended;
  }, [assetTagSuggestions.recommended]);

  const handleFactoryUpload = async () => {
    if (!user) {
      return;
    }

    const parsedWorkNumber = Number(workNumber);
    const parsedVariantNumber = Number(variantNumber);

    if (!Number.isInteger(parsedWorkNumber) || parsedWorkNumber < 1) {
      setStatusError('Work number must be a positive integer.');
      setStatusMessage(null);
      return;
    }

    if (!Number.isInteger(parsedVariantNumber) || parsedVariantNumber < 1) {
      setStatusError('Variant number must be a positive integer.');
      setStatusMessage(null);
      return;
    }

    if (selectedFiles.length === 0) {
      setStatusError('Select at least one image file to upload.');
      setStatusMessage(null);
      return;
    }

    const invalidFiles = selectedFiles.filter((file) => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      setStatusError(`Only image files are allowed: ${invalidFiles.map((file) => file.name).join(', ')}`);
      setStatusMessage(null);
      return;
    }

    const oversizedFiles = selectedFiles.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      setStatusError(`Max file size is ${MAX_FILE_SIZE_MB}MB: ${oversizedFiles.map((file) => file.name).join(', ')}`);
      setStatusMessage(null);
      return;
    }

    // Upload now also creates the variant project in one step. If a project
    // for this variant already exists, the upload overwrites its banners and
    // outputs, so confirm before proceeding.
    const projectKey = `${seriesSlug}:${parsedWorkNumber}:${parsedVariantNumber}`;
    const willOverwrite = recentProjectMap.has(projectKey);
    if (willOverwrite) {
      const confirmed = window.confirm(
        `A project for ${formatSeriesLabel(seriesSlug)} ${formatWorkDisplayCode(parsedWorkNumber)}-${parsedVariantNumber} already exists. Uploading will overwrite its draft banners and outputs. Continue?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setUploading(true);
    setStatusError(null);
    setStatusMessage(null);

    let successCount = 0;
    let failCount = 0;
    const insertedAssets: DefaultImage[] = [];

    try {
      const supabase = await getSupabase();
      const workTags = parseTagInput(workTagInput);
      const assetTags = parseTagInput(assetTagInput);
      const workCode = formatWorkDisplayCode(parsedWorkNumber);
      const variantCode = `${workCode}-${parsedVariantNumber}`;

      await ensureCanonicalWorkVariant({
        workSeriesSlug: seriesSlug,
        workNumber: parsedWorkNumber,
        variantNumber: parsedVariantNumber,
        workTitle,
        workSummary,
        releasedOn,
        workTags: workTags.length > 0 ? workTags : undefined,
      });

      for (const file of selectedFiles) {
        try {
          const pathBase = `official/${seriesSlug}/${variantCode}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
          // Route new default-images uploads to R2 when configured (opt-in r2),
          // recording storage_provider so the read path resolves the right
          // backend. Falls back to Supabase Storage when R2 is unavailable.
          const useR2 = isR2Configured;
          const publicUrl = await uploadFileToBucket(file, 'default-images', pathBase, { r2: useR2 });
          // The R2 public URL is not a Supabase public URL, so derive the
          // bucket-relative storage path deterministically instead of parsing it.
          const storagePath = useR2
            ? `${pathBase}.${getExtensionFromMime(file.type || '')}`
            : extractStoragePathFromPublicUrl(publicUrl, 'default-images');

          if (!storagePath) {
            throw new Error(`Failed to resolve storage path for ${file.name}`);
          }

          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
          });
          URL.revokeObjectURL(objectUrl);

          // Generate and upload a JPEG thumbnail (max 400px, quality 0.7) so the
          // factory grid and library load lightweight previews.
          const thumbnail = await generateImageThumbnail(file);
          let thumbnailPath: string | null = null;
          if (thumbnail) {
            const thumbStoragePath = `thumbnails/${pathBase}.jpg`;
            if (useR2) {
              await uploadBlobToR2(toR2Key('default-images', thumbStoragePath), thumbnail.blob, 'image/jpeg');
            } else {
              const { error: thumbError } = await supabase.storage
                .from('default-images')
                .upload(thumbStoragePath, thumbnail.blob, { contentType: 'image/jpeg', upsert: true });
              if (thumbError) throw thumbError;
            }
            thumbnailPath = thumbStoragePath;
          }

          const insertedAsset = await insertDefaultImageRecord({
            name: file.name,
            storagePath,
            thumbnailPath,
            storageProvider: useR2 ? 'r2' : 'supabase',
            width: img.width,
            height: img.height,
            fileSize: file.size,
            sourceContext: 'content_factory',
            workSeriesSlug: seriesSlug,
            workNumber: parsedWorkNumber,
            variantNumber: parsedVariantNumber,
            assetRole,
            tags: assetTags,
            notes: notes.trim() || null,
          });

          insertedAssets.push(insertedAsset);
          successCount += 1;
        } catch (error) {
          console.error('Factory upload failed:', file.name, error);
          failCount += 1;
        }
      }

      await loadOfficialAssets();
      await loadTagSuggestions();
      setSelectedFiles([]);

      const label = `${formatSeriesLabel(seriesSlug)} ${workCode}-${parsedVariantNumber}`;

      if (successCount === 0) {
        setStatusError('All uploads failed. Check storage permissions and metadata schema.');
        return;
      }

      // Upload and project creation are now a single step. Pick the primary
      // asset (character cutout if present) as the project source.
      const primaryAsset =
        insertedAssets.find((asset) => asset.asset_role === 'character_cutout') ?? insertedAssets[0] ?? null;

      let projectNote = '';
      if (primaryAsset) {
        try {
          const result = await ensureProductionProjectFromAsset(primaryAsset, user.id, {
            overwriteExisting: willOverwrite,
            workTitle,
            workSummary,
            releasedOn,
            workTags,
          });
          await invalidateBannerCollectionQueries(queryClient);
          await invalidateProductionProjectQueries(queryClient);
          await loadProjects();

          projectNote = willOverwrite
            ? ' Existing project was overwritten with fresh draft banners.'
            : ` Created a production project with ${result.createdBannerCount} draft banners.`;
        } catch (projectError) {
          console.error('Failed to create production project after upload:', projectError);
          setStatusError(
            `Uploaded ${successCount} asset(s) for ${label}, but project creation failed: ${
              projectError instanceof Error ? projectError.message : 'unknown error'
            }. Use "Create Project" on the asset card to retry.`,
          );
          return;
        }
      }

      const uploadNote =
        failCount === 0
          ? `Uploaded ${successCount} official asset(s) for ${label}.`
          : `Uploaded ${successCount} asset(s) (${failCount} failed) for ${label}.`;
      setStatusMessage(`${uploadNote} Canonical work metadata is saved in works/work_variants.${projectNote} You can now return to the Content Factory list.`);
    } catch (error) {
      console.error('Failed to upload official assets:', error);
      setStatusError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProject = async (asset: DefaultImage) => {
    if (!user) {
      return;
    }

    const projectKey = `${asset.work_series_slug}:${asset.work_number}:${asset.variant_number ?? 1}`;
    const existingProject = recentProjectMap.get(projectKey);
    if (existingProject) {
      const confirmed = window.confirm(
        `A project for ${formatWorkVariantLabel(asset)} already exists. Overwrite its banners and outputs?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setCreatingProjectAssetId(asset.id);
    setStatusError(null);
    setStatusMessage(null);

    try {
      await ensureCanonicalWorkVariant({
        workSeriesSlug: asset.work_series_slug ?? 'episode',
        workNumber: asset.work_number ?? 0,
        variantNumber: asset.variant_number ?? 1,
      });

      const result = await ensureProductionProjectFromAsset(asset, user.id, {
        overwriteExisting: Boolean(existingProject),
      });
      await invalidateBannerCollectionQueries(queryClient);
      await invalidateProductionProjectQueries(queryClient);
      await loadProjects();

      const label = `${formatSeriesLabel(asset.work_series_slug)} ${formatWorkDisplayCode(asset.work_number ?? 0)}-${asset.variant_number ?? 1}`;
      if (existingProject) {
        setStatusMessage(`Overwrote production project for ${label}. Draft banners and outputs were reset.`);
      } else if (result.createdProject) {
        setStatusMessage(`Created production project for ${label}. ${result.createdBannerCount} draft banners are now in your designs.`);
      } else if (result.createdBannerCount > 0) {
        setStatusMessage(`Updated ${label}. Missing draft banners were generated and attached to the existing project.`);
      } else {
        setStatusMessage(`Project for ${label} already exists and is in sync.`);
      }
    } catch (error) {
      console.error('Failed to create production project:', error);
      setStatusError(error instanceof Error ? error.message : 'Failed to create production project.');
    } finally {
      setCreatingProjectAssetId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#101010]">
        <div className="h-8 w-8 rounded-full border-2 border-gray-300 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <SitePageLayout maxWidthClassName="max-w-7xl" mainClassName="py-12 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <Link to="/mydesign/factory" className="text-blue-600 hover:text-blue-700 inline-block mb-4">
            &larr; Back to Content Factory List
          </Link>
          <h1 className="text-3xl font-bold text-white text-balance">
            Content Factory
          </h1>
        </div>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 text-balance">Official Asset Intake</h2>
              <p className="mt-1 text-sm text-gray-500 text-pretty">
                ここでシリーズ、番号、枝番を付けてアップロードします。Gallery の正規構造へ寄せる最初のステップです。
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              First production step
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Series</span>
              <select
                value={seriesSlug}
                onChange={(event) => setSeriesSlug(event.target.value as WorkSeriesSlug)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {WORK_SERIES_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Work Number</span>
              <input
                type="number"
                min="1"
                step="1"
                value={workNumber}
                onChange={(event) => setWorkNumber(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 tabular-nums"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Variant</span>
              <input
                type="number"
                min="1"
                step="1"
                value={variantNumber}
                onChange={(event) => setVariantNumber(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 tabular-nums"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Asset Role</span>
              <select
                value={assetRole}
                onChange={(event) => setAssetRole(event.target.value as (typeof OFFICIAL_ASSET_ROLE_OPTIONS)[number]['value'])}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {OFFICIAL_ASSET_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs text-gray-500">
                Default is `Character Cutout`. Change it here when uploading a background, logo, reference, or derived asset.
              </span>
            </label>
          </div>

          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Work Metadata</div>
            <p className="mt-1 text-xs text-gray-500 text-pretty">
              Gallery の canonical な `works / work_variants` に保存される情報です。Content Factory が正本になります。
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block lg:col-span-2">
                <span className="mb-2 block text-sm font-medium text-gray-700">Work Title</span>
                <input
                  type="text"
                  value={workTitle}
                  onChange={(event) => setWorkTitle(event.target.value)}
                  placeholder={buildDefaultWorkTitle(seriesSlug, Number(workNumber) || 0)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <span className="mt-2 block text-xs text-gray-500 text-pretty">
                  `Series + Work Number` から自動入力されます。必要なら手動で上書きできます。
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-gray-700">Release Date</span>
                <input
                  type="date"
                  value={releasedOn}
                  onChange={(event) => setReleasedOn(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                />
                <span className="mt-2 block text-xs text-gray-500">
                  Default: {todayDefault}
                </span>
              </label>

              <div className="hidden lg:block" />
            </div>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Work Tags</span>
              <input
                type="text"
                value={workTagInput}
                onChange={(event) => setWorkTagInput(event.target.value)}
                list="content-factory-work-tags"
                placeholder="nature, portrait, cyberpunk"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <datalist id="content-factory-work-tags">
                {workTagSuggestions.history.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="flex flex-wrap gap-2">
                  {workTagSuggestions.recommended && (
                    <button
                      type="button"
                      onClick={() => setWorkTagInput((current) => appendTagToInput(current, workTagSuggestions.recommended ?? ''))}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Recommended: {workTagSuggestions.recommended}
                    </button>
                  )}
                  {workTagSuggestions.popular
                    .filter((tag) => tag !== workTagSuggestions.recommended)
                    .slice(0, 4)
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setWorkTagInput((current) => appendTagToInput(current, tag))}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        {tag}
                      </button>
                    ))}
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-gray-500">History</span>
                  <select
                    defaultValue=""
                    aria-label="Add work tag from history"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        return;
                      }
                      setWorkTagInput((current) => appendTagToInput(current, value));
                      event.target.value = '';
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">Add from history...</option>
                    {workTagSuggestions.history.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <span className="mt-2 block text-xs text-gray-500 text-pretty">
                直近と使用頻度の高いタグから候補を出します。カンマ区切りで複数登録できます。
              </span>
            </label>

            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Summary</span>
              <textarea
                value={workSummary}
                onChange={(event) => setWorkSummary(event.target.value)}
                rows={3}
                placeholder="Short gallery description for this work."
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Asset Tags</span>
              <input
                type="text"
                value={assetTagInput}
                onChange={(event) => setAssetTagInput(event.target.value)}
                list="content-factory-asset-tags"
                placeholder="character, main, pink"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
              <datalist id="content-factory-asset-tags">
                {assetTagSuggestions.history.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>
              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="flex flex-wrap gap-2">
                  {assetTagSuggestions.recommended && (
                    <button
                      type="button"
                      onClick={() => setAssetTagInput((current) => appendTagToInput(current, assetTagSuggestions.recommended ?? ''))}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Recommended: {assetTagSuggestions.recommended}
                    </button>
                  )}
                  {assetTagSuggestions.popular
                    .filter((tag) => tag !== assetTagSuggestions.recommended)
                    .slice(0, 4)
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setAssetTagInput((current) => appendTagToInput(current, tag))}
                        className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                      >
                        {tag}
                      </button>
                    ))}
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-medium text-gray-500">History</span>
                  <select
                    defaultValue=""
                    aria-label="Add asset tag from history"
                    onChange={(event) => {
                      const value = event.target.value;
                      if (!value) {
                        return;
                      }
                      setAssetTagInput((current) => appendTagToInput(current, value));
                      event.target.value = '';
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">Add from history...</option>
                    {assetTagSuggestions.history.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <span className="mt-2 block text-xs text-gray-500 text-pretty">
                公式素材で直近またはよく使われるタグを再利用できます。
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Files</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
                className="block w-full rounded-xl border border-gray-300 bg-white px-3 py-[7px] text-sm text-gray-900"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Asset Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Pose, intended use, background direction, or remarks for later template creation."
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-500 text-pretty">
              Target: <span className="font-medium text-gray-700">{formatSeriesLabel(seriesSlug)} {formatWorkDisplayCode(Number(workNumber) || 0)}-{variantNumber || '1'}</span>
              <span className="ml-2">Canonical work data is stored in `works/work_variants`. Assets stay in `default_images`, and a linked production project is created automatically.</span>
            </div>
            <button
              type="button"
              onClick={handleFactoryUpload}
              disabled={uploading}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading & Creating Project...' : 'Upload & Create Project'}
            </button>
          </div>

          {selectedFiles.length > 0 && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {selectedFiles.length} file(s): {selectedFiles.map((file) => file.name).join(', ')}
            </div>
          )}

          {statusMessage && (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {statusMessage}
            </div>
          )}

          {statusError && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {statusError}
            </div>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 text-balance">Recent Official Assets</h2>
              <p className="mt-1 text-sm text-gray-500 text-pretty">
                Premium library assets. 作品本体ではなく、production project が参照する素材です。
              </p>
            </div>
            <Link
              to="/banner"
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open Editor
            </Link>
          </div>

          {assetsLoading ? (
            <div className="mt-4 text-sm text-gray-500">Loading official assets...</div>
          ) : assetsError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {assetsError}
            </div>
          ) : officialAssets.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
              No official assets yet. Upload character cutouts here first.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {officialAssets.map((asset) => {
                const projectKey = `${asset.work_series_slug}:${asset.work_number}:${asset.variant_number ?? 1}`;
                const linkedProject = recentProjectMap.get(projectKey);

                return (
                <div key={asset.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <div className="aspect-[4/3] bg-white">
                    <img
                      src={resolveAssetUrl(asset.storage_provider ?? 'supabase', 'default-images', asset.thumbnail_path || asset.storage_path)}
                      alt={asset.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="space-y-2 p-4">
                    {linkedProject ? (
                      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] text-green-800">
                        Project exists · {linkedProject.banners.length} linked banners
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate text-sm font-semibold text-gray-900">{asset.name}</div>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {asset.asset_role ?? 'general'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatWorkVariantLabel(asset)}
                    </div>
                    <div className="text-xs text-gray-500 tabular-nums">
                      {asset.width ?? '-'} x {asset.height ?? '-'}
                    </div>
                    {asset.tags && asset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {asset.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-gray-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCreateProject(asset)}
                      disabled={creatingProjectAssetId === asset.id || !asset.work_series_slug || !asset.work_number}
                      className="w-full rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingProjectAssetId === asset.id
                        ? 'Saving Project...'
                        : linkedProject
                          ? 'Overwrite Existing Project'
                          : 'Create Project'}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 text-balance">Workflow</h2>
                <p className="mt-1 text-sm text-gray-500 text-pretty">
                  作品ごとに `character asset - master design - build outputs - publish` を固定する。
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                Current target state
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {workflowSteps.map((step, index) => (
                <div key={step.name} className="rounded-xl border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white tabular-nums">
                          {index + 1}
                        </span>
                        <h3 className="text-sm font-semibold text-gray-900">{step.name}</h3>
                      </div>
                      <p className="mt-3 text-sm text-gray-700 text-pretty">{step.summary}</p>
                      <p className="mt-2 text-xs text-gray-500 text-pretty">{step.detail}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(step.status)}`}>
                      {statusLabel(step.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 text-balance">Operating Rules</h2>
              <div className="mt-4 space-y-4 text-sm text-gray-600">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="font-semibold text-gray-900">1. User artwork stays private by default</div>
                  <p className="mt-2 text-pretty">
                    通常ユーザーの保存物は banner として扱い、admin が template 化した時だけ一般向けラインナップになる。
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="font-semibold text-gray-900">2. Official assets live in the same library table</div>
                  <p className="mt-2 text-pretty">
                    `default_images` は premium ライブラリの素材台帳であり、作品 metadata の正本ではない。作品本体は `works/work_variants` に置く。
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="font-semibold text-gray-900">3. Two masters, not one</div>
                  <p className="mt-2 text-pretty">
                    portrait master と landscape master を分け、品質を落とさずに mobile / PC / feed を派生させる。
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900 text-balance">Output Specs</h2>
              <div className="mt-4 space-y-3">
                {outputSpecs.map((spec) => (
                  <div key={spec.label} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{spec.label}</div>
                        <div className="mt-1 text-xs text-gray-500">{spec.role}</div>
                      </div>
                      <div className="text-sm font-medium text-gray-700 tabular-nums">{spec.size}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 text-balance">Recent Production Projects</h2>
                  <p className="mt-1 text-sm text-gray-500 text-pretty">
                    1 project は 1 variant package。ここから 4 種の draft banner を editor で調整する。
                  </p>
                </div>
                <Link
                  to="/banners"
                  className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Open My Designs
                </Link>
              </div>

              {projectsLoading ? (
                <div className="mt-4 text-sm text-gray-500">Loading production projects...</div>
              ) : projectsError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {projectsError}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500">
                  No production projects yet. Create one from an official asset.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {recentProjects.map((entry) => (
                    <div key={entry.project.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-gray-900">
                              {formatSeriesLabel(entry.project.work_series_slug)} {entry.project.work_display_code}-{entry.project.variant_number}
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                              {entry.project.status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {entry.project.title ?? 'Untitled production project'}
                          </div>
                          {entry.sourceAsset && (
                            <div className="mt-3 flex items-center gap-3">
                              <div className="size-12 overflow-hidden rounded-lg bg-white">
                                <img
                                  src={resolveAssetUrl(entry.sourceAsset.storage_provider ?? 'supabase', 'default-images', entry.sourceAsset.storage_path)}
                                  alt={entry.sourceAsset.name}
                                  className="h-full w-full object-contain"
                                  loading="lazy"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-gray-700">{entry.sourceAsset.name}</div>
                                <div className="text-[11px] text-gray-500">Primary source asset</div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {new Date(entry.project.updated_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {entry.banners.map((banner) => (
                          <Link
                            key={banner.linkId}
                            to={`/banner/${banner.bannerId}`}
                            className="rounded-xl border border-gray-200 bg-white px-3 py-3 hover:border-gray-300"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-gray-900">{banner.name}</div>
                                <div className="mt-1 text-[11px] text-gray-500">
                                  {banner.role} · {banner.width ?? '-'} x {banner.height ?? '-'}
                                </div>
                              </div>
                              <span className="text-xs text-blue-600">Open</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 text-balance">Implementation Order</h2>
              <p className="mt-1 text-sm text-gray-500 text-pretty">
                この画面を起点に、先に workflow を固定し、その後に storage と delivery を分離していく。
              </p>
            </div>
            <span className="text-xs text-gray-400">Docs: `imagine/docs/WALLPAPER_FACTORY_PLAN.md`</span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {implementationPhases.map((phase) => (
              <div key={phase.title} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-xs font-semibold text-gray-500">{phase.title}</div>
                <h3 className="mt-2 text-base font-semibold text-gray-900 text-balance">{phase.summary}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  {phase.items.map((item) => (
                    <li key={item} className="text-pretty">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </SitePageLayout>
  );
}
