import { useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { SortableGrid } from '../components/SortableGrid';
import { bannerStorage } from '../utils/bannerStorage';
import {
  useBanners,
  useDeleteBanner,
  useDuplicateBanner,
  useFactoryBannerIds,
  useUpdateBannerName,
  bannerKeys,
} from '../hooks/useBanners';
import type { BannerListItem, CanvasElement, Template } from '../types/template';
import { useAuth } from '../contexts/AuthContext';
import { filterBySize, getAspectClass, getGridCols, resolveSizeCategory } from '../utils/sizeCategories';
import { downloadImageFromUrl } from '../utils/exportImage';

export const BannersBySize = () => {
  const { sizeKey } = useParams<{ sizeKey: string }>();
  const { t, i18n } = useTranslation(['banner', 'common', 'message']);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, profile, loading: authLoading } = useAuth();
  const isGuest = !user;
  const isAdmin = profile?.role === 'admin';
  const isFactoryView = new URLSearchParams(location.search).get('source') === 'factory';
  const guestStorageKey = 'banalist_guest_banner';
  const [guestBanner, setGuestBanner] = useState<BannerListItem | null>(null);

  // React Query hooks
  const { data: banners = [], isLoading } = useBanners();
  const { data: factoryBannerIds = [], isLoading: factoryIdsLoading } = useFactoryBannerIds(!isGuest && isAdmin);
  const deleteBanner = useDeleteBanner();
  const duplicateBanner = useDuplicateBanner();
  const updateName = useUpdateBannerName(editingId || '');

  useEffect(() => {
    if (!isGuest) {
      setGuestBanner(null);
      return;
    }
    try {
      const stored = localStorage.getItem(guestStorageKey);
      if (!stored) {
        setGuestBanner(null);
        return;
      }
      const parsed = JSON.parse(stored) as {
        name: string;
        template: { name: string; width?: number; height?: number };
        updatedAt?: string;
        createdAt?: string;
        thumbnailUrl?: string;
        fullresUrl?: string;
      };
      setGuestBanner({
        id: 'guest',
        name: parsed.name || parsed.template?.name || 'Guest Banner',
        updatedAt: parsed.updatedAt || parsed.createdAt || new Date().toISOString(),
        thumbnailUrl: parsed.thumbnailUrl,
        fullresUrl: parsed.fullresUrl,
        width: parsed.template?.width,
        height: parsed.template?.height,
      });
    } catch {
      setGuestBanner(null);
    }
  }, [isGuest]);

  const handleDeleteBanner = async (id: string) => {
    if (window.confirm(t('message:confirm.deleteBanner'))) {
      await deleteBanner.mutateAsync(id);
    }
  };

  const handleDuplicateBanner = async (id: string) => {
    await duplicateBanner.mutateAsync(id);
  };

  const handleStartEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const handleSaveName = async () => {
    if (editingName.trim()) {
      await updateName.mutateAsync(editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const handleBannerClick = (banner: BannerListItem) => {
    const returnTo = `${location.pathname}${location.search}`;

    if (isGuest && banner.id === 'guest') {
      try {
        const stored = localStorage.getItem(guestStorageKey);
        if (!stored) return;
        const parsed = JSON.parse(stored) as {
          name: string;
          template: Template;
          elements: CanvasElement[];
          canvasColor: string;
        };
        navigate('/banner', {
          state: {
            template: parsed.template,
            elements: parsed.elements,
            canvasColor: parsed.canvasColor,
            name: parsed.name,
            templateId: parsed.template.id,
          },
        });
      } catch {
        // Ignore error
      }
      return;
    }
    navigate(`/banner/${banner.id}`, {
      state: { returnTo },
    });
  };

  const handleDownloadBanner = async (banner: BannerListItem) => {
    if (!banner.fullresUrl) {
      alert(t('banner:downloadUnavailable'));
      return;
    }

    try {
      await downloadImageFromUrl(banner.fullresUrl, `${banner.name}.png`);
    } catch (error) {
      console.error('Failed to download banner asset:', error);
      alert(t('message:error.exportFailed'));
    }
  };

  const factoryBannerIdSet = new Set(factoryBannerIds);
  const displayedBanners = isGuest
    ? (guestBanner ? [guestBanner] : [])
    : isFactoryView
      ? banners.filter((banner) => factoryBannerIdSet.has(banner.id))
      : banners;
  const category = resolveSizeCategory(sizeKey, displayedBanners);

  // Filter banners by the current category size
  const filteredBanners = category
    ? filterBySize(displayedBanners, category.width, category.height)
    : [];

  // Handle reorder for banners (used by SortableGrid)
  const handleReorderBanners = async (reorderedBanners: BannerListItem[]) => {
    const orders = reorderedBanners.map((b, index) => ({
      id: b.id,
      displayOrder: index + 1,
    }));

    try {
      await bannerStorage.updateDisplayOrders(orders);
      queryClient.invalidateQueries({ queryKey: bannerKeys.lists() });
    } catch (error) {
      console.error('Failed to update display orders:', error);
    }
  };

  // Grid columns based on aspect ratio
  const gridCols = category
    ? getGridCols(category.width, category.height)
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
  const listPath = isFactoryView ? '/mydesign/factory' : '/banners';

  if (isFactoryView && !authLoading && !isAdmin) {
    return <Navigate to="/banners" replace />;
  }

  // Render a single banner card
  const renderBannerCard = (banner: BannerListItem) => {
    const isGuestBanner = isGuest && banner.id === 'guest';
    const aspectClass = getAspectClass(banner.width, banner.height);

    return (
      <div
        key={banner.id}
        className="group bg-white rounded-lg border border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all overflow-hidden"
      >
        <div
          className={`${aspectClass} bg-gray-100 cursor-pointer relative overflow-hidden`}
          onClick={() => handleBannerClick(banner)}
        >
          {banner.thumbnailUrl ? (
            <>
              {imageLoadingStates[banner.id] && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="text-xs text-gray-500">{t('common:status.loading')}</span>
                  </div>
                </div>
              )}
              <img
                src={banner.thumbnailUrl}
                alt={banner.name}
                className="w-full h-full object-cover"
                onLoadStart={() => {
                  setImageLoadingStates((prev) => ({ ...prev, [banner.id]: true }));
                }}
                onLoad={() => {
                  setImageLoadingStates((prev) => ({ ...prev, [banner.id]: false }));
                }}
                onError={() => {
                  setImageLoadingStates((prev) => ({ ...prev, [banner.id]: false }));
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

          {/* Semi-transparent overlay with banner info */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8">
            {editingId === banner.id ? (
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                onBlur={() => handleSaveName()}
                onClick={(e) => e.stopPropagation()}
                className="w-full px-2 py-1 text-sm font-medium bg-white/90 border border-indigo-500 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1 mb-1">
                <h3 className="font-medium text-white text-sm truncate flex-1">{banner.name}</h3>
                {!isGuestBanner && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(banner.id, banner.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-all"
                    title={t('banner:editName')}
                  >
                    <svg
                      className="w-3.5 h-3.5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}
            <p className="text-xs text-white/80">{formatDate(banner.updatedAt)}</p>
          </div>

          {/* Action buttons overlay (top right) */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDownloadBanner(banner);
              }}
              disabled={!banner.fullresUrl}
              className="w-7 h-7 bg-white/90 hover:bg-white text-gray-700 rounded-md transition-colors flex items-center justify-center group/download relative shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title={banner.fullresUrl ? t('banner:download') : t('banner:downloadUnavailable')}
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/download:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {banner.fullresUrl ? t('banner:download') : t('banner:downloadUnavailable')}
              </span>
            </button>
            {!isGuest && (
              <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateBanner(banner.id);
                }}
                disabled={duplicateBanner.isPending}
                className="w-7 h-7 bg-white/90 hover:bg-white text-gray-700 rounded-md transition-colors flex items-center justify-center group/duplicate relative shadow-sm disabled:opacity-50"
                title={t('banner:duplicate')}
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/duplicate:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {t('banner:duplicate')}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBanner(banner.id);
                }}
                disabled={deleteBanner.isPending}
                className="w-7 h-7 bg-white/90 hover:bg-white text-red-600 rounded-md transition-colors flex items-center justify-center group/delete relative shadow-sm disabled:opacity-50"
                title={t('banner:delete')}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span className="absolute bottom-full mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover/delete:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {t('banner:delete')}
                </span>
              </button>
              </>
            )}
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
              onClick={() => navigate(listPath)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('banner:backToDesigns')}
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
              <button
                onClick={() => navigate(listPath)}
                className="hover:text-indigo-400 transition-colors"
              >
                {isFactoryView ? t('banner:factoryBannersTitle') : t('banner:title')}
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
            <span className="text-sm font-normal text-gray-500">— {t('common:items', { count: filteredBanners.length })}</span>
          </h2>
        </div>

        {isLoading || (isFactoryView && factoryIdsLoading) ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">{t('common:status.loading')}</p>
          </div>
        ) : filteredBanners.length === 0 ? (
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
              {isFactoryView ? t('banner:noFactoryBannersForSize') : t('banner:noDesignsForSize')}
            </h3>
            <p className="text-gray-400 mb-6">
              {isFactoryView ? t('banner:factoryEmptyStateMessage') : t('banner:createDesignFromTemplate')}
            </p>
            <button
              onClick={() => navigate(listPath)}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('banner:backToDesigns')}
            </button>
          </div>
        ) : (
          <SortableGrid
            items={filteredBanners}
            disabled={isGuest}
            gridClassName={`grid ${gridCols} gap-4`}
            onReorder={handleReorderBanners}
            renderItem={renderBannerCard}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};
