import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SitePageLayout } from '../components/SitePageLayout';
import { getSupabase, getSupabaseStoragePublicUrl } from '../utils/supabase';
import { extractStoragePathFromPublicUrl, uploadFileToBucket } from '../utils/storage';
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
import type { DefaultImage } from '../types/image-library';
import type { ProductionProjectSummary } from '../types/production-project';
import { invalidateBannerCollectionQueries } from '../hooks/useBanners';
import { invalidateProductionProjectQueries } from '../hooks/useProductionProjects';
import { ensureProductionProjectFromAsset, getPrimaryEditBanner, loadRecentProductionProjects } from '../utils/productionProjects';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const [assetRole, setAssetRole] = useState<(typeof OFFICIAL_ASSET_ROLE_OPTIONS)[number]['value']>('character_cutout');
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user || profile?.role !== 'admin') {
      return;
    }

    void loadOfficialAssets();
    void loadProjects();
  }, [profile?.role, user]);

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

    setUploading(true);
    setStatusError(null);
    setStatusMessage(null);

    let successCount = 0;
    let failCount = 0;

    try {
      const tags = parseTagInput(tagInput);
      const workCode = formatWorkDisplayCode(parsedWorkNumber);
      const variantCode = `${workCode}-${parsedVariantNumber}`;

      for (const file of selectedFiles) {
        try {
          const pathBase = `official/${seriesSlug}/${variantCode}/${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const publicUrl = await uploadFileToBucket(file, 'default-images', pathBase);
          const storagePath = extractStoragePathFromPublicUrl(publicUrl, 'default-images');

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

          await insertDefaultImageRecord({
            name: file.name,
            storagePath,
            width: img.width,
            height: img.height,
            fileSize: file.size,
            sourceContext: 'content_factory',
            workSeriesSlug: seriesSlug,
            workNumber: parsedWorkNumber,
            variantNumber: parsedVariantNumber,
            assetRole,
            tags,
            notes: notes.trim() || null,
          });

          successCount += 1;
        } catch (error) {
          console.error('Factory upload failed:', file.name, error);
          failCount += 1;
        }
      }

      await loadOfficialAssets();
      setSelectedFiles([]);

      if (successCount > 0 && failCount === 0) {
        setStatusMessage(`Uploaded ${successCount} official asset(s) for ${formatSeriesLabel(seriesSlug)} ${workCode}-${parsedVariantNumber}.`);
      } else if (successCount > 0) {
        setStatusMessage(`Uploaded ${successCount} asset(s). ${failCount} file(s) failed.`);
      } else {
        setStatusError('All uploads failed. Check storage permissions and metadata schema.');
      }
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

    setCreatingProjectAssetId(asset.id);
    setStatusError(null);
    setStatusMessage(null);

    try {
      const result = await ensureProductionProjectFromAsset(asset, user.id);
      await invalidateBannerCollectionQueries(queryClient);
      await invalidateProductionProjectQueries(queryClient);
      await loadProjects();

      const label = `${formatSeriesLabel(asset.work_series_slug)} ${formatWorkDisplayCode(asset.work_number ?? 0)}-${asset.variant_number ?? 1}`;
      const primaryBanner = getPrimaryEditBanner(result.banners);
      if (result.createdProject) {
        setStatusMessage(`Created production project for ${label}. ${result.createdBannerCount} draft banners are now in your designs.`);
      } else if (result.createdBannerCount > 0) {
        setStatusMessage(`Updated ${label}. Missing draft banners were generated and attached to the existing project.`);
      } else {
        setStatusMessage(`Project for ${label} already exists and is in sync.`);
      }

      if (primaryBanner) {
        navigate(`/banner/${primaryBanner.bannerId}`, {
          state: { returnTo: '/admin/content-factory' },
        });
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
          <Link to="/admin" className="text-blue-600 hover:text-blue-700 inline-block mb-4">
            &larr; Back to Admin
          </Link>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  Admin Only
                </span>
                <h1 className="mt-4 text-3xl font-bold text-gray-900 text-balance">
                  Content Factory
                </h1>
                <p className="mt-3 text-sm text-gray-600 text-pretty">
                  WHATIF 公式作品の制作パイプラインを、一般ユーザー向け template 導線と混ぜずに管理するための運用画面です。
                  最初の入口は、作品 metadata 付きで premium asset を登録することです。
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[22rem]">
                <Link
                  to="/banners"
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="text-sm font-semibold text-gray-900">Open Banner Library</div>
                  <div className="mt-1 text-xs text-gray-500 text-pretty">
                    保存済み artwork と素材の混在状況を確認
                  </div>
                </Link>
                <Link
                  to="/banner"
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="text-sm font-semibold text-gray-900">Open Editor</div>
                  <div className="mt-1 text-xs text-gray-500 text-pretty">
                    portrait / landscape master の調整へ移動
                  </div>
                </Link>
              </div>
            </div>
          </div>
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
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">Tags</span>
              <input
                type="text"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="character, main, pink"
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              />
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
            <span className="mb-2 block text-sm font-medium text-gray-700">Notes</span>
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
              <span className="ml-2">Stored in `default_images` as a premium asset.</span>
            </div>
            <button
              type="button"
              onClick={handleFactoryUpload}
              disabled={uploading}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload Official Assets'}
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
                    公式素材は premium ライブラリそのものとして `default_images` に登録し、そこから直接会員が利用できる状態にする。
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
                  <h2 className="text-xl font-semibold text-gray-900 text-balance">Recent Official Assets</h2>
                  <p className="mt-1 text-sm text-gray-500 text-pretty">
                    Content Factory から登録した画像を起点に、variant 単位の production project と 4 種の draft banner を作る。
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
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {officialAssets.map((asset) => (
                    <div key={asset.id} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                      <div className="aspect-[4/3] bg-white">
                        <img
                          src={getSupabaseStoragePublicUrl('default-images', asset.storage_path)}
                          alt={asset.name}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div className="space-y-2 p-4">
                        {(() => {
                          const projectKey = `${asset.work_series_slug}:${asset.work_number}:${asset.variant_number ?? 1}`;
                          const linkedProject = recentProjectMap.get(projectKey);
                          return linkedProject ? (
                            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[11px] text-green-800">
                              Project exists · {linkedProject.banners.length} linked banners
                            </div>
                          ) : null;
                        })()}
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
                          {creatingProjectAssetId === asset.id ? 'Creating Project...' : 'Create, Sync, and Open Editor'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                                  src={getSupabaseStoragePublicUrl('default-images', entry.sourceAsset.storage_path)}
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
