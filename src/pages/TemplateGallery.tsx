import { useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { GalleryTabs } from '../components/GalleryTabs';
import { UpgradeModal } from '../components/UpgradeModal';
import { EditTemplateModal } from '../components/EditTemplateModal';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { LikeButton } from '../components/LikeButton';
import { DemoCanvas } from '../components/DemoCanvas';
import { GuestLimitModal } from '../components/GuestLimitModal';
import { TemplateWallpaperExporter } from '../components/TemplateWallpaperExporter';
import { useTemplates, templateKeys } from '../hooks/useTemplates';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';
import type { Template, TemplateRecord } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { THE_CLUB_ENTRY_URL, THE_CLUB_THUMBNAILS } from '../data/theClubThumbnails';
import { bannerStorage } from '../utils/bannerStorage';
import { hasGuestDesignConflict, isPremiumTemplate } from '../utils/guestDesign';
import { templateStorage } from '../utils/templateStorage';
import { SIZE_CATEGORIES, filterBySize, getAspectClass, getGridCols } from '../utils/sizeCategories';

const MAX_DISPLAY_COUNT = 30;
const MAX_CLUB_THUMBNAILS = 50;

const PromoSectionHeader = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <div className="mb-6 w-full">
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
      {eyebrow}
    </p>
    <h2 className="mt-2 text-2xl font-bold text-gray-100 md:text-3xl">
      {title}
    </h2>
    <p className="mt-3 text-sm leading-relaxed text-gray-400 md:text-base">
      {description}
    </p>
  </div>
);

export const TemplateGallery = () => {
  const { t } = useTranslation(['banner', 'common', 'message', 'auth', 'modal']);
  const [templateImageLoadingStates, setTemplateImageLoadingStates] = useState<Record<string, boolean>>({});
  const [templateActionId, setTemplateActionId] = useState<string | null>(null);
  const [templateDownloadId, setTemplateDownloadId] = useState<string | null>(null);
  const [downloadTemplate, setDownloadTemplate] = useState<TemplateRecord | null>(null);
  const [pendingGuestTemplate, setPendingGuestTemplate] = useState<TemplateRecord | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateRecord | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const isGuest = !user;
  const isAdmin = profile?.role === 'admin';
  const clubThumbnailPreviews = THE_CLUB_THUMBNAILS.slice(0, MAX_CLUB_THUMBNAILS);

  const { data: templates = [], isLoading: templatesLoading } = useTemplates();

  const handleClubThumbnailError = (
    e: SyntheticEvent<HTMLImageElement>,
    fallbackUrl: string,
  ) => {
    const image = e.currentTarget;
    if (image.dataset.fallbackApplied === 'true') return;
    image.dataset.fallbackApplied = 'true';
    image.src = fallbackUrl;
  };

  // Handle reorder for templates (used by SortableGrid)
  const handleReorderTemplates = async (reorderedTemplates: TemplateRecord[]) => {
    const orders = reorderedTemplates.map((t, index) => ({
      id: t.id,
      displayOrder: index + 1,
    }));

    try {
      await templateStorage.updateDisplayOrders(orders);
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    } catch (error) {
      console.error('Failed to update display orders:', error);
    }
  };

  // Filter templates by size category
  const filterTemplatesBySize = (targetWidth: number, targetHeight: number) => {
    return filterBySize(templates, targetWidth, targetHeight);
  };

  const buildEditorTemplate = (template: TemplateRecord): Template => {
    const fallbackTemplate = DEFAULT_TEMPLATES[0];
    return {
      id: template.id,
      name: template.name,
      width: template.width ?? fallbackTemplate.width,
      height: template.height ?? fallbackTemplate.height,
      backgroundColor: template.canvasColor,
      thumbnail: template.thumbnailUrl,
      planType: template.planType,
    };
  };

  const handleTemplateClick = async (template: TemplateRecord) => {
    const resolvedTemplate = template.elements
      ? template
      : await templateStorage.getById(template.id);
    if (!resolvedTemplate?.elements) {
      alert(t('banner:templateLoadFailed'));
      return;
    }

    const guestAllowed = !isPremiumTemplate(resolvedTemplate);
    if (isGuest && !guestAllowed) {
      setShowUpgradeModal(true);
      return;
    }

    if (isPremiumTemplate(resolvedTemplate)) {
      if (!user || !profile || profile.subscriptionTier === 'free') {
        setShowUpgradeModal(true);
        return;
      }
    }

    // Fire-and-forget: increment open count
    templateStorage.incrementOpenCount(template.id);

    const editorTemplate = buildEditorTemplate(resolvedTemplate);
    const templateElements = JSON.parse(JSON.stringify(resolvedTemplate.elements || []));

    if (!user) {
      if (hasGuestDesignConflict(resolvedTemplate.id)) {
        setPendingGuestTemplate(resolvedTemplate);
        return;
      }

      navigate('/banner', {
        state: {
          template: editorTemplate,
          elements: templateElements,
          canvasColor: resolvedTemplate.canvasColor,
          name: resolvedTemplate.name,
          templateId: resolvedTemplate.id,
        },
      });
      return;
    }

    setTemplateActionId(template.id);
    try {
      const created = await bannerStorage.createFromTemplate(resolvedTemplate, editorTemplate);
      if (created) {
        navigate(`/banner/${created.id}`);
      }
    } finally {
      setTemplateActionId(null);
    }
  };

  const handleTemplateWallpaperDownload = async (template: TemplateRecord) => {
    const resolvedTemplate = template.elements
      ? template
      : await templateStorage.getById(template.id);
    if (!resolvedTemplate?.elements) {
      alert(t('banner:templateLoadFailed'));
      return;
    }

    const guestAllowed = !isPremiumTemplate(resolvedTemplate);
    if (isGuest && !guestAllowed) {
      setShowUpgradeModal(true);
      return;
    }

    if (isPremiumTemplate(resolvedTemplate)) {
      if (!user || !profile || profile.subscriptionTier === 'free') {
        setShowUpgradeModal(true);
        return;
      }
    }

    setTemplateDownloadId(template.id);
    setDownloadTemplate(resolvedTemplate);
  };

  // Render a single template card
  const renderTemplateCard = (template: TemplateRecord) => {
    const aspectClass = getAspectClass(template.width, template.height);

    return (
      <div
        key={template.id}
        className="group bg-white rounded-lg border border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all overflow-hidden"
      >
        <div
          className={`${aspectClass} bg-gray-100 relative overflow-hidden cursor-pointer`}
          onClick={() => handleTemplateClick(template)}
        >
          {template.thumbnailUrl ? (
            <>
              {templateImageLoadingStates[template.id] && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="text-xs text-gray-500">{t('common:status.loading')}</span>
                  </div>
                </div>
              )}
              <img
                src={template.thumbnailUrl}
                alt={template.name}
                className="w-full h-full object-cover"
                onLoadStart={() => {
                  setTemplateImageLoadingStates((prev) => ({ ...prev, [template.id]: true }));
                }}
                onLoad={() => {
                  setTemplateImageLoadingStates((prev) => ({ ...prev, [template.id]: false }));
                }}
                onError={() => {
                  setTemplateImageLoadingStates((prev) => ({ ...prev, [template.id]: false }));
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
              <div className="flex flex-col items-center gap-2">
                <svg
                  className="w-12 h-12 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-xs text-gray-400">{t('common:thumbnail.noThumbnail')}</span>
              </div>
            </div>
          )}

          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <div
              className={`h-6 px-2 rounded-md shadow text-white inline-flex items-center ${
                template.planType === 'premium'
                  ? 'bg-gradient-to-r from-yellow-400 to-amber-500'
                  : 'bg-emerald-500/90'
              }`}
            >
              <span className="text-xs font-bold">
                {template.planType === 'premium' ? 'PREMIUM' : 'FREE'}
              </span>
            </div>
          </div>
          <div
            className="absolute top-2 right-2 z-10"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <LikeButton templateId={template.id} likeCount={template.likeCount ?? 0} />
          </div>
          {isGuest && isPremiumTemplate(template) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/60 text-white h-16 w-16 rounded-full shadow-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-[40px]">lock</span>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <button
                className="w-28 py-2 bg-white/95 text-gray-900 text-xs font-semibold rounded shadow-sm hover:bg-white"
                disabled={templateActionId === template.id}
              >
                {templateActionId === template.id
                  ? t('common:status.creating')
                  : t('banner:open')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleTemplateWallpaperDownload(template);
                }}
                className="w-28 py-2 bg-indigo-600/95 text-white text-xs font-semibold rounded shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                disabled={templateDownloadId === template.id}
              >
                {templateDownloadId === template.id
                  ? t('common:status.loading')
                  : t('banner:wallpaperDownload')}
              </button>
              {isAdmin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTemplate(template);
                  }}
                  className="w-28 py-2 bg-gray-900 text-white text-xs font-semibold rounded shadow-sm hover:bg-gray-800"
                >
                  {t('modal:editTemplate.editButton')}
                </button>
              )}
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white text-sm truncate">{template.name}</h3>
              {(template.openCount ?? 0) > 0 && (
                <span className="text-[11px] text-white/50 whitespace-nowrap flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">person</span>
                  {template.openCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#101010]">
      <Header />

      {/* Hero Section - Guest Only */}
      {isGuest && (
        <section className="pt-20 pb-24 px-6">
          <div className="max-w-5xl mx-auto text-center">
            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
              {t('common:hero.headline1')}{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t('common:hero.headline2')}
              </span>
              <br />
              <span className="text-gray-400 text-4xl md:text-5xl lg:text-6xl font-medium">
                {t('common:hero.headline3')}
              </span>
            </h1>

            {/* Description */}
            <p className="text-lg md:text-xl text-gray-400 mb-16 max-w-3xl mx-auto leading-[1.3]">
              {t('common:hero.description')}
            </p>

            {/* Interactive Demo Canvas */}
            <div className="max-w-5xl mx-auto flex justify-center px-4">
              {/* Mobile (320px): scale=0.15, Mobile (425px+): scale=0.20, Tablet: scale=0.35, Desktop: scale=0.45 */}
              <div className="md:hidden w-full max-w-[90vw]">
                <DemoCanvas scale={0.16} />
              </div>
              <div className="hidden md:block lg:hidden">
                <DemoCanvas scale={0.35} />
              </div>
              <div className="hidden lg:block">
                <DemoCanvas scale={0.45} />
              </div>
            </div>
          </div>
        </section>
      )}

      <main className="max-w-7xl mx-auto px-6 py-8">
        <section className="mb-10 border-t border-gray-800 pt-12">
          <PromoSectionHeader
            eyebrow={t('common:templatePromo.eyebrow')}
            title={t('common:templatePromo.title')}
            description={t('common:templatePromo.description')}
          />
        </section>

        <GalleryTabs />

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-100">
            {t('banner:templatesTitle')} ({templates.length})
          </h2>
        </div>

        {templatesLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <p className="mt-3 text-gray-600">{t('common:status.loading')}</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12 text-gray-400">{t('banner:noTemplates')}</div>
        ) : (
          <div className="space-y-10">
            {SIZE_CATEGORIES.map((category) => {
              const filteredTemplates = filterTemplatesBySize(category.width, category.height);
              if (filteredTemplates.length === 0) return null;
              const displayTemplates = filteredTemplates.slice(0, MAX_DISPLAY_COUNT);
              const hasMore = filteredTemplates.length > MAX_DISPLAY_COUNT;
              const gridCols = getGridCols(category.width, category.height);

              return (
                <section key={category.key}>
                  <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/templates/${category.key}`)}
                      className="hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                      {category.label}
                    </button>
                    <span className="text-sm font-normal text-gray-400">
                      ({category.width}×{category.height})
                    </span>
                    <span className="text-sm font-normal text-gray-500">
                      — {t('common:items', { count: filteredTemplates.length })}
                    </span>
                  </h3>

                  <SortableGrid
                    items={displayTemplates}
                    disabled={!isAdmin}
                    gridClassName={`grid ${gridCols} gap-4`}
                    onReorder={handleReorderTemplates}
                    renderItem={renderTemplateCard}
                  />
                  {hasMore && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => navigate(`/templates/${category.key}`)}
                        className="px-6 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 rounded-lg transition-colors"
                      >
                        {t('common:showMore', { count: filteredTemplates.length - MAX_DISPLAY_COUNT })}
                        <span className="ml-1">→</span>
                      </button>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {!templatesLoading && (
          <section className="mt-20 border-t border-gray-800 pt-12">
            <PromoSectionHeader
              eyebrow={t('common:clubPromo.eyebrow')}
              title={t('common:clubPromo.title')}
              description={t('common:clubPromo.description')}
            />

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {clubThumbnailPreviews.map((item) => (
                <a
                  key={item.id}
                  href={THE_CLUB_ENTRY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900/60 transition-all hover:border-amber-400/70 hover:shadow-lg hover:shadow-amber-500/10"
                >
                  <div className="aspect-square bg-gray-900">
                    <img
                      src={item.thumbnailUrlJpg}
                      alt={`${item.label} wallpaper preview`}
                      loading="lazy"
                      onError={(e) => handleClubThumbnailError(e, item.thumbnailUrlPng)}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 py-2">
                    <p className="text-xs font-semibold text-white">{item.label}</p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-amber-300/90">
                      {t('common:clubPromo.tag')}
                    </p>
                  </div>
                </a>
              ))}
            </div>

            <div className="mt-8 text-center">
              <a
                href={THE_CLUB_ENTRY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-lg border border-gray-700 px-6 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:border-amber-400 hover:text-amber-300"
              >
                {t('common:clubPromo.more')}
              </a>
            </div>
          </section>
        )}
      </main>

      <TemplateWallpaperExporter
        template={downloadTemplate}
        onComplete={(result) => {
          if (result.isIOS && result.method !== 'share-files') {
            alert(t('message:info.saveImageGuide'));
          }
          if (result.inAppBrowser) {
            alert(t('message:info.inAppBrowserGuide'));
          }
          setTemplateDownloadId(null);
          setDownloadTemplate(null);
        }}
        onError={(error) => {
          if (error.name !== 'AbortError') {
            alert(t('message:error.exportFailed'));
          }
          setTemplateDownloadId(null);
          setDownloadTemplate(null);
        }}
      />
      <GuestLimitModal
        isOpen={!!pendingGuestTemplate}
        onClose={() => setPendingGuestTemplate(null)}
        title={t('banner:guestLimitTitle')}
        message={t('banner:guestOverwriteConfirm')}
        cancelLabel={t('common:button.cancel')}
        confirmLabel={t('banner:open')}
        onConfirm={() => {
          if (!pendingGuestTemplate) return;

          const editorTemplate = buildEditorTemplate(pendingGuestTemplate);
          const templateElements = JSON.parse(JSON.stringify(pendingGuestTemplate.elements || []));

          setPendingGuestTemplate(null);
          navigate('/banner', {
            state: {
              template: editorTemplate,
              elements: templateElements,
              canvasColor: pendingGuestTemplate.canvasColor,
              name: pendingGuestTemplate.name,
              templateId: pendingGuestTemplate.id,
            },
          });
        }}
      />
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      <EditTemplateModal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        template={editingTemplate}
        onSave={async (params) => {
          if (!editingTemplate) return;
          await templateStorage.updateTemplate(editingTemplate.id, params);
          queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        }}
        onDelete={async () => {
          if (!editingTemplate) return;
          await templateStorage.deleteTemplate(editingTemplate.id);
          queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
        }}
      />
      <Footer />
    </div>
  );
};
