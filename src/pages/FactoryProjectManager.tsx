import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SitePageLayout } from '../components/SitePageLayout';
import { GalleryTabs } from '../components/GalleryTabs';
import { useAuth } from '../contexts/AuthContext';
import { invalidateBannerCollectionQueries } from '../hooks/useBanners';
import {
  invalidateProductionProjectQueries,
  useRecentProductionProjects,
} from '../hooks/useProductionProjects';
import {
  buildProductionOutputs,
  publishProductionProject,
} from '../utils/productionOutputBuilder';
import { parseTagInput } from '../utils/libraryAssets';
import { deleteProductionProject, updateProductionProjectWorkMetadata } from '../utils/productionProjects';
import type { ProductionProjectBannerRole, ProductionProjectSummary, ProductionProjectStatus } from '../types/production-project';

const PROJECT_LIMIT = 60;

// Cover is not an editable draft — it is generated headlessly at output
// build time (see productionOutputBuilder), so it is not listed here.
const ROLE_ORDER: ProductionProjectBannerRole[] = [
  'portrait_master',
  'landscape_master',
  'instagram_feed',
];

const ROLE_META: Record<
  ProductionProjectBannerRole,
  { label: string; description: string; aspectRatio: string }
> = {
  portrait_master: {
    label: 'Portrait',
    description: 'Mobile QHD',
    aspectRatio: '9 / 16',
  },
  landscape_master: {
    label: 'Landscape',
    description: 'PC QHD',
    aspectRatio: '16 / 9',
  },
  instagram_feed: {
    label: 'Feed',
    description: 'Instagram Feed',
    aspectRatio: '4 / 5',
  },
  package_cover: {
    label: 'Cover',
    description: 'Package Cover',
    aspectRatio: '1 / 1',
  },
  imagine_template: {
    label: 'Template',
    description: 'Imagine Template',
    aspectRatio: '4 / 5',
  },
};

function formatProjectUpdatedAt(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function statusClasses(status: ProductionProjectSummary['project']['status']): string {
  switch (status) {
    case 'published':
      return 'bg-green-100 text-green-800';
    case 'ready':
      return 'bg-blue-100 text-blue-800';
    case 'review':
      return 'bg-amber-100 text-amber-800';
    case 'in_progress':
      return 'bg-slate-200 text-slate-800';
    case 'archived':
      return 'bg-slate-100 text-slate-500';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function statusLabel(status: ProductionProjectStatus): string {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'review':
      return 'Review';
    case 'ready':
      return 'Ready';
    case 'published':
      return 'Published';
    case 'archived':
      return 'Archived';
    default:
      return 'Draft';
  }
}

function chipClass(active: boolean): string {
  return active
    ? 'rounded-full border border-indigo-500 bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-200'
    : 'rounded-full border border-gray-700 bg-[#171717] px-3 py-1 text-xs font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100';
}

type SortOrder = 'latest' | 'oldest';

// Sort by work number first, then variant number, so the same work's
// variants stay grouped. "latest" puts the highest number on top.
function compareByNumber(
  a: ProductionProjectSummary,
  b: ProductionProjectSummary,
  order: SortOrder,
): number {
  const workDiff = (a.project.work_number ?? 0) - (b.project.work_number ?? 0);
  const diff =
    workDiff !== 0
      ? workDiff
      : (a.project.variant_number ?? 0) - (b.project.variant_number ?? 0);
  return order === 'latest' ? -diff : diff;
}

type FactoryBannerCardProps = {
  banner: ProductionProjectSummary['banners'][number];
  title: string;
  label: string;
  description: string;
  aspectRatio: string;
  onOpen: () => void;
  noThumbnailLabel: string;
  openLabel: string;
};

type ProjectMetadataEditorProps = {
  entry: ProductionProjectSummary;
  disabled: boolean;
  onSave: (params: {
    projectId: string;
    workTitle: string;
    workSummary: string;
    releasedOn: string;
    workTags: string[];
  }) => Promise<void>;
};

function ProjectMetadataEditor({ entry, disabled, onSave }: ProjectMetadataEditorProps) {
  const [workTitle, setWorkTitle] = useState(entry.project.work_title ?? entry.canonicalWork?.title ?? '');
  const [releasedOn, setReleasedOn] = useState(entry.project.released_on ?? entry.canonicalWork?.releasedOn ?? '');
  const [workSummary, setWorkSummary] = useState(entry.project.work_summary ?? entry.canonicalWork?.summary ?? '');
  const [workTagInput, setWorkTagInput] = useState((entry.project.work_tags ?? entry.canonicalWork?.tags ?? []).join(', '));

  return (
    <div className="mt-4 rounded-xl border border-gray-800 bg-[#111111] p-4">
      <div className="text-sm font-semibold text-gray-100">Work Metadata</div>
      <p className="mt-1 text-xs text-gray-500">
        Publish writes these values into the canonical Gallery work.
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <label className="block lg:col-span-2">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">Work Title</span>
          <input
            type="text"
            value={workTitle}
            onChange={(event) => setWorkTitle(event.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-700 bg-[#171717] px-3 py-2 text-sm text-gray-100 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">Release Date</span>
          <input
            type="date"
            value={releasedOn}
            onChange={(event) => setReleasedOn(event.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-700 bg-[#171717] px-3 py-2 text-sm text-gray-100 disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">Work Tags</span>
          <input
            type="text"
            value={workTagInput}
            onChange={(event) => setWorkTagInput(event.target.value)}
            disabled={disabled}
            placeholder="nature, portrait, cyberpunk"
            className="w-full rounded-lg border border-gray-700 bg-[#171717] px-3 py-2 text-sm text-gray-100 disabled:opacity-60"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-gray-400">Summary</span>
        <textarea
          value={workSummary}
          onChange={(event) => setWorkSummary(event.target.value)}
          disabled={disabled}
          rows={3}
          className="w-full rounded-lg border border-gray-700 bg-[#171717] px-3 py-2 text-sm text-gray-100 disabled:opacity-60"
        />
      </label>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() =>
            void onSave({
              projectId: entry.project.id,
              workTitle,
              workSummary,
              releasedOn,
              workTags: parseTagInput(workTagInput),
            })
          }
          disabled={disabled}
          className="rounded-lg border border-gray-700 bg-[#171717] px-3 py-2 text-sm font-medium text-gray-100 transition-colors hover:border-indigo-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save Metadata
        </button>
      </div>
    </div>
  );
}

function FactoryBannerCard({
  banner,
  title,
  label,
  description,
  aspectRatio,
  onOpen,
  noThumbnailLabel,
  openLabel,
}: FactoryBannerCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const previewUrl = imageFailed ? null : banner.thumbnailUrl ?? banner.fullresUrl ?? null;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${title} ${label}`}
      className="rounded-xl border border-gray-800 bg-[#111111] p-3 text-left transition-colors hover:border-indigo-500 hover:bg-[#151515]"
    >
      <div
        className="overflow-hidden rounded-lg bg-[#1b1b1b]"
        style={{ aspectRatio }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={banner.name}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs font-medium text-gray-500">
            {noThumbnailLabel}
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-sm font-semibold text-gray-100">{label}</div>
        <div className="mt-1 text-xs text-gray-400">{description}</div>
        <div className="mt-3 text-xs font-medium text-indigo-300">
          {openLabel}
        </div>
      </div>
    </button>
  );
}

export function FactoryProjectManager() {
  const { t, i18n } = useTranslation(['banner', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, loading } = useAuth();
  const [pendingByProject, setPendingByProject] = useState<Record<string, 'publish' | 'delete' | 'save' | undefined>>({});
  const [messageByProject, setMessageByProject] = useState<Record<string, string | undefined>>({});
  const [errorByProject, setErrorByProject] = useState<Record<string, string | undefined>>({});
  const {
    data: projects = [],
    isLoading,
    error,
  } = useRecentProductionProjects(PROJECT_LIMIT, !!user && profile?.role === 'admin');
  const [statusFilter, setStatusFilter] = useState<ProductionProjectStatus | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');

  // Only offer status chips that actually exist in the loaded projects.
  const availableStatuses = useMemo(() => {
    const present = new Set<ProductionProjectStatus>();
    for (const entry of projects) {
      present.add(entry.project.status);
    }
    return Array.from(present);
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const filtered =
      statusFilter === 'all'
        ? projects
        : projects.filter((entry) => entry.project.status === statusFilter);
    return [...filtered].sort((a, b) => compareByNumber(a, b, sortOrder));
  }, [projects, statusFilter, sortOrder]);

  const handlePublish = async (entry: ProductionProjectSummary) => {
    setPendingByProject((prev) => ({ ...prev, [entry.project.id]: 'publish' }));
    setErrorByProject((prev) => ({ ...prev, [entry.project.id]: undefined }));
    setMessageByProject((prev) => ({ ...prev, [entry.project.id]: undefined }));

    try {
      const result = await buildProductionOutputs(entry);
      await publishProductionProject(entry);
      await invalidateProductionProjectQueries(queryClient);
      setMessageByProject((prev) => ({
        ...prev,
        [entry.project.id]: t('banner:factoryPublishSuccess', { count: result.outputCount }),
      }));
    } catch (error) {
      setErrorByProject((prev) => ({
        ...prev,
        [entry.project.id]: error instanceof Error ? error.message : t('banner:factoryPublishFailed'),
      }));
    } finally {
      setPendingByProject((prev) => ({ ...prev, [entry.project.id]: undefined }));
    }
  };

  const handleDelete = async (entry: ProductionProjectSummary) => {
    if (!user) {
      return;
    }

    const title = entry.project.title ?? `${entry.project.work_series_slug} ${entry.project.work_display_code}-${entry.project.variant_number}`;
    const confirmed = window.confirm(
      `Delete "${title}" and all linked draft banners / outputs? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setPendingByProject((prev) => ({ ...prev, [entry.project.id]: 'delete' }));
    setErrorByProject((prev) => ({ ...prev, [entry.project.id]: undefined }));
    setMessageByProject((prev) => ({ ...prev, [entry.project.id]: undefined }));

    try {
      await deleteProductionProject(entry.project.id, user.id);
      await invalidateBannerCollectionQueries(queryClient);
      await invalidateProductionProjectQueries(queryClient);
      setMessageByProject((prev) => ({
        ...prev,
        [entry.project.id]: 'Deleted project and all linked assets.',
      }));
    } catch (error) {
      setErrorByProject((prev) => ({
        ...prev,
        [entry.project.id]: error instanceof Error ? error.message : 'Failed to delete project.',
      }));
    } finally {
      setPendingByProject((prev) => ({ ...prev, [entry.project.id]: undefined }));
    }
  };

  const handleSaveMetadata = async (params: {
    projectId: string;
    workTitle: string;
    workSummary: string;
    releasedOn: string;
    workTags: string[];
  }) => {
    setPendingByProject((prev) => ({ ...prev, [params.projectId]: 'save' }));
    setErrorByProject((prev) => ({ ...prev, [params.projectId]: undefined }));
    setMessageByProject((prev) => ({ ...prev, [params.projectId]: undefined }));

    try {
      await updateProductionProjectWorkMetadata(params);
      await invalidateProductionProjectQueries(queryClient);
      setMessageByProject((prev) => ({
        ...prev,
        [params.projectId]: 'Saved work metadata. Republish to reflect it in the Gallery.',
      }));
    } catch (error) {
      setErrorByProject((prev) => ({
        ...prev,
        [params.projectId]: error instanceof Error ? error.message : 'Failed to save work metadata.',
      }));
    } finally {
      setPendingByProject((prev) => ({ ...prev, [params.projectId]: undefined }));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#101010]">
        <div className="size-8 rounded-full border-2 border-gray-600 border-t-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/mydesign" replace />;
  }

  return (
    <SitePageLayout maxWidthClassName="max-w-7xl" mainClassName="py-8 sm:px-6">
      <div>
        <GalleryTabs />

        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-100 text-balance">
              {t('banner:factoryProjectsTitle')} ({statusFilter === 'all' ? projects.length : visibleProjects.length})
            </h2>
            <p className="mt-2 text-sm text-gray-400 text-pretty">
              {t('banner:factoryProjectsDescription')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/content-factory"
              className="inline-flex items-center rounded-lg border border-gray-700 bg-[#171717] px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-indigo-500 hover:text-white"
            >
              {t('banner:factoryAdmin')}
            </Link>
            <Link
              to="/admin/cover-lab"
              className="inline-flex items-center rounded-lg border border-gray-700 bg-[#171717] px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-indigo-500 hover:text-white"
            >
              {t('banner:factoryCoverLab')}
            </Link>
          </div>
        </div>

        {!isLoading && !error && projects.length > 0 && (
          <div className="mb-6 flex flex-col gap-3 border-b border-gray-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('banner:factoryFilterStatusLabel')}
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={chipClass(statusFilter === 'all')}
              >
                {t('banner:factoryFilterAll')}
              </button>
              {availableStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={chipClass(statusFilter === status)}
                >
                  {statusLabel(status)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {t('banner:factorySortLabel')}
              </span>
              <button
                type="button"
                onClick={() => setSortOrder('latest')}
                className={chipClass(sortOrder === 'latest')}
              >
                {t('banner:factorySortLatest')}
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('oldest')}
                className={chipClass(sortOrder === 'oldest')}
              >
                {t('banner:factorySortOldest')}
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gray-800 bg-[#171717] p-5"
              >
                <div className="h-6 w-40 rounded bg-gray-800" />
                <div className="mt-3 h-4 w-56 rounded bg-gray-900" />
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((__, slotIndex) => (
                    <div key={slotIndex} className="rounded-xl border border-gray-800 bg-[#111111] p-3">
                      <div className="aspect-[4/5] rounded-lg bg-gray-900" />
                      <div className="mt-3 h-4 w-20 rounded bg-gray-800" />
                      <div className="mt-2 h-3 w-24 rounded bg-gray-900" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-100">
            {error instanceof Error ? error.message : t('banner:factoryProjectsLoadFailed')}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-[#171717] p-10 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#222222]">
              <svg className="size-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="mt-5 text-lg font-medium text-gray-100 text-balance">
              {t('banner:noFactoryProjects')}
            </h3>
            <p className="mt-2 text-sm text-gray-400 text-pretty">
              {t('banner:factoryProjectEmptyStateMessage')}
            </p>
            <button
              type="button"
              onClick={() => navigate('/mydesign')}
              className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              {t('banner:backToDesigns')}
            </button>
          </div>
        ) : visibleProjects.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-[#171717] p-10 text-center text-sm text-gray-400">
            {t('banner:factoryNoMatchingProjects')}
          </div>
        ) : (
          <div className="space-y-6">
            {visibleProjects.map((entry) => {
              const bannersByRole = new Map(entry.banners.map((banner) => [banner.role, banner]));
              const title = entry.project.title ?? `${entry.project.work_series_slug} ${entry.project.work_display_code}-${entry.project.variant_number}`;
              const pendingAction = pendingByProject[entry.project.id];
              const isPublished = entry.project.status === 'published';
              const isPending = !!pendingAction;

              return (
                <section
                  key={entry.project.id}
                  className="rounded-2xl border border-gray-800 bg-[#171717] p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b border-gray-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-100 text-balance">{title}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses(entry.project.status)}`}>
                          {statusLabel(entry.project.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                        <span className="tabular-nums">
                          {t('banner:factoryProjectUpdatedAt')}: {formatProjectUpdatedAt(entry.project.updated_at, i18n.language)}
                        </span>
                        {entry.sourceAsset ? (
                          <span className="truncate">
                            {t('banner:factoryProjectSourceAsset')}: {entry.sourceAsset.name}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handlePublish(entry)}
                        disabled={isPending}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pendingAction === 'publish'
                          ? t('banner:factoryPublishing')
                          : isPublished
                            ? 'Republish'
                            : t('banner:factoryPublish')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(entry)}
                        disabled={isPending}
                        className="rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-900/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pendingAction === 'delete'
                          ? 'Deleting...'
                          : 'Delete Project'}
                      </button>
                    </div>
                  </div>

                  {(messageByProject[entry.project.id] || errorByProject[entry.project.id]) && (
                    <div className="mt-4 rounded-xl border border-gray-800 bg-[#111111] px-4 py-3 text-sm">
                      {messageByProject[entry.project.id] ? (
                        <p className="text-green-300">{messageByProject[entry.project.id]}</p>
                      ) : null}
                      {errorByProject[entry.project.id] ? (
                        <p className="text-red-300">{errorByProject[entry.project.id]}</p>
                      ) : null}
                    </div>
                  )}

                  <ProjectMetadataEditor
                    key={`${entry.project.id}:${entry.project.updated_at}`}
                    entry={entry}
                    disabled={isPending}
                    onSave={handleSaveMetadata}
                  />

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {ROLE_ORDER.map((role) => {
                      const banner = bannersByRole.get(role);
                      const meta = ROLE_META[role];

                      if (!banner) {
                        return (
                          <div
                            key={role}
                            className="rounded-xl border border-dashed border-gray-700 bg-[#111111] p-3"
                          >
                            <div
                              className="rounded-lg bg-[#1b1b1b]"
                              style={{ aspectRatio: meta.aspectRatio }}
                            />
                            <div className="mt-3">
                              <div className="text-sm font-semibold text-gray-200">{meta.label}</div>
                              <div className="mt-1 text-xs text-gray-500">{meta.description}</div>
                              <div className="mt-3 text-xs font-medium text-amber-300">
                                {t('banner:factorySlotPreparing')}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <FactoryBannerCard
                          key={`${role}:${banner.bannerId}:${banner.thumbnailUrl ?? ''}:${banner.fullresUrl ?? ''}`}
                          banner={banner}
                          title={title}
                          label={meta.label}
                          description={meta.description}
                          aspectRatio={meta.aspectRatio}
                          onOpen={() =>
                            navigate(`/banner/${banner.bannerId}`, {
                              state: { returnTo: '/mydesign/factory' },
                            })
                          }
                          noThumbnailLabel={t('common:thumbnail.noThumbnail')}
                          openLabel={t('banner:open')}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </SitePageLayout>
  );
}
