import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { UpgradeModal } from '../components/UpgradeModal';
import { EditTemplateModal } from '../components/EditTemplateModal';
import { GuestLimitModal } from '../components/GuestLimitModal';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { LikeButton } from '../components/LikeButton';
import { TemplateWallpaperExporter } from '../components/TemplateWallpaperExporter';
import { useTemplates, templateKeys } from '../hooks/useTemplates';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';
import type { Template, TemplateRecord } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { bannerStorage } from '../utils/bannerStorage';
import { hasGuestDesignConflict, isPremiumTemplate } from '../utils/guestDesign';
import { templateStorage } from '../utils/templateStorage';
import { SIZE_CATEGORIES, getAspectClass, getGridCols } from '../utils/sizeCategories';

export const TemplatesBySize = () => {
  const { sizeKey } = useParams<{ sizeKey: string }>();
  const { t } = useTranslation(['banner', 'common', 'message', 'auth', 'modal']);
  const [templateImageLoadingStates, setTemplateImageLoadingStates] = useState<
    Record<string, boolean>
  >({});
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

  // Find the current category
  const category = SIZE_CATEGORIES.find((c) => c.key === sizeKey);

  const { data: templates = [], isLoading: templatesLoading } = useTemplates();

  // Filter templates by the current category size
  const filteredTemplates = category
    ? templates.filter(
        (template) => template.width === category.width && template.height === category.height
      )
    : [];

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

  // Grid columns based on aspect ratio
  const gridCols = category
    ? getGridCols(category.width, category.height)
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

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

  // If category not found, show error
  if (!category) {
    return (
      <div className="min-h-screen bg-[#101010]">
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">{t('banner:categoryNotFound')}</h2>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('banner:backToTemplates')}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101010]">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm text-gray-400">
            <li>
              <button onClick={() => navigate('/')} className="hover:text-indigo-400 transition-colors">
                {t('banner:templatesTitle')}
              </button>
            </li>
            <li>/</li>
            <li className="text-gray-100">{category.label}</li>
          </ol>
        </nav>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
            {category.label}
            <span className="text-sm font-normal text-gray-400">
              ({category.width}×{category.height})
            </span>
            <span className="text-sm font-normal text-gray-500">— {t('common:items', { count: filteredTemplates.length })}</span>
          </h2>
        </div>

        {templatesLoading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">{t('common:status.loading')}</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-700 mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
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
            </div>
            <h3 className="text-lg font-medium text-gray-300 mb-2">
              {t('banner:noTemplatesForSize')}
            </h3>
          </div>
        ) : (
          <SortableGrid
            items={filteredTemplates}
            disabled={!isAdmin}
            gridClassName={`grid ${gridCols} gap-4`}
            onReorder={handleReorderTemplates}
            renderItem={renderTemplateCard}
          />
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
