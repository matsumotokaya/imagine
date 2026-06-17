import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getSupabase, getSupabaseStoragePublicUrl } from '../utils/supabase';
import type { DefaultImage, UserImage } from '../types/image-library';
import { formatWorkVariantLabel, insertUserImageRecord } from '../utils/libraryAssets';

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string, width: number, height: number) => void;
  initialTab?: 'default' | 'user';
}

type TabType = 'default' | 'user';

type DefaultImageWithUrl = DefaultImage & { displayUrl?: string };
type UserImageWithUrl = UserImage & { displayUrl?: string };

type ImageWithUrl = DefaultImageWithUrl | UserImageWithUrl;

const PAGE_SIZE = 16;

export const ImageLibraryModal = ({ isOpen, onClose, onSelectImage, initialTab = 'user' }: ImageLibraryModalProps) => {
  const { t } = useTranslation(['modal', 'message']);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [defaultImages, setDefaultImages] = useState<DefaultImageWithUrl[]>([]);
  const [userImages, setUserImages] = useState<UserImageWithUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const urlCacheRef = useRef<Map<string, string>>(new Map());

  // Check if current user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = await getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user role:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data?.role === 'admin');
      }
    };
    checkAdmin();
  }, []);

  // Set initial tab and reset page when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setCurrentPage(0);
    }
  }, [isOpen, initialTab]);

  // Load images when modal opens, tab changes, or page changes
  useEffect(() => {
    if (!isOpen) return;

    const fetchImages = async () => {
      const supabase = await getSupabase();
      setLoading(true);
      const offset = currentPage * PAGE_SIZE;
      const to = offset + PAGE_SIZE - 1;

      if (activeTab === 'default') {
        const { data, error, count } = await supabase
          .from('default_images')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, to);

        if (error) {
          console.error('Error fetching default images:', error);
          setDefaultImages([]);
          setTotalCount(0);
        } else if (data) {
          setDefaultImages(data);
          setTotalCount(count ?? 0);
        }
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setUserImages([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }

        const { data, error, count } = await supabase
          .from('user_images')
          .select('*', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('asset_scope', 'user')
          .order('created_at', { ascending: false })
          .range(offset, to);

        if (error) {
          console.error('Error fetching user images:', error);
          setUserImages([]);
          setTotalCount(0);
        } else if (data) {
          setUserImages(data);
          setTotalCount(count ?? 0);
        }
      }

      setLoading(false);
    };

    fetchImages();
  }, [isOpen, activeTab, currentPage]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(0);
  };

  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);

    const invalidFiles = fileArray.filter(file => !file.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      alert(t('message:error.onlyImageFiles'));
      return;
    }

    const oversizedFiles = fileArray.filter(file => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      alert(`Max file size: ${MAX_FILE_SIZE_MB}MB. Too large: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert(t('modal:imageLibrary.loginRequired'));
      return;
    }

    setUploading(true);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const file of fileArray) {
        try {
          const img = new Image();
          const objectUrl = URL.createObjectURL(file);

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
          });

          const width = img.width;
          const height = img.height;
          URL.revokeObjectURL(objectUrl);

          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;

          if (activeTab === 'default') {
            const filePath = fileName;
            const { error: uploadError } = await supabase.storage.from('default-images').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase.from('default_images').insert({
              name: file.name,
              storage_path: filePath,
              width,
              height,
              file_size: file.size,
              tags: [],
            });
            if (dbError) throw dbError;
          } else {
            const filePath = `${user.id}/${fileName}`;
            const { error: uploadError } = await supabase.storage.from('user-images').upload(filePath, file);
            if (uploadError) throw uploadError;

            await insertUserImageRecord({
              userId: user.id,
              name: file.name,
              storagePath: filePath,
              width,
              height,
              fileSize: file.size,
              assetScope: 'user',
              sourceContext: 'editor',
              assetRole: 'general',
            });
          }

          successCount++;
        } catch (error) {
          console.error('Error uploading file:', file.name, error);
          failCount++;
        }
      }

      // After upload, go to page 0 to see newly uploaded images
      setCurrentPage(0);

      if (failCount === 0) {
        alert(t('modal:imageLibrary.uploadSuccess', { count: successCount }));
      } else {
        alert(t('modal:imageLibrary.uploadPartialFail', { success: successCount, fail: failCount }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(t('modal:imageLibrary.uploadFailed'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Get cached public URL (no transform — requires paid plan)
  const getCachedDisplayUrl = (storagePath: string, bucketName: 'default-images' | 'user-images'): string => {
    const cacheKey = `${bucketName}:${storagePath}`;

    if (urlCacheRef.current.has(cacheKey)) {
      return urlCacheRef.current.get(cacheKey)!;
    }

    const publicUrl = getSupabaseStoragePublicUrl(bucketName, storagePath);
    urlCacheRef.current.set(cacheKey, publicUrl);
    return publicUrl;
  };

  const getPublicUrl = (storagePath: string, bucketName: 'default-images' | 'user-images'): string => {
    return getSupabaseStoragePublicUrl(bucketName, storagePath);
  };

  const handleSelectDefaultImage = (image: DefaultImageWithUrl) => {
    const publicUrl = getPublicUrl(image.storage_path, 'default-images');
    onSelectImage(publicUrl, image.width || 800, image.height || 600);
    onClose();
  };

  const handleSelectUserImage = (image: UserImageWithUrl) => {
    const publicUrl = getPublicUrl(image.storage_path, 'user-images');
    onSelectImage(publicUrl, image.width || 800, image.height || 600);
    onClose();
  };

  if (!isOpen) return null;

  const images = activeTab === 'default' ? defaultImages : userImages;
  const noImagesKey = activeTab === 'default' ? 'noDefaultImages' : 'noUserImages';
  const bucketName = activeTab === 'default' ? 'default-images' : 'user-images';
  const handleSelect = activeTab === 'default' ? handleSelectDefaultImage : handleSelectUserImage;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const pages: (number | '...')[] = [];
    const left = Math.max(1, currentPage - 1);
    const right = Math.min(totalPages - 2, currentPage + 1);
    pages.push(0);
    if (left > 1) pages.push('...');
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 2) pages.push('...');
    pages.push(totalPages - 1);
    return pages;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative bg-[#1a1a1a] rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <h2 className="text-base font-semibold text-gray-100">
            {t('modal:imageLibrary.title')}
            {totalCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">{totalCount} images</span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabs + Upload */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#333]">
          <div className="flex bg-[#111] rounded p-0.5 gap-0.5">
            <button
              onClick={() => handleTabChange('default')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'default'
                  ? 'bg-[#2b2b2b] text-gray-100'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t('modal:imageLibrary.tabs.default')}
            </button>
            <button
              onClick={() => handleTabChange('user')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'user'
                  ? 'bg-[#2b2b2b] text-gray-100'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t('modal:imageLibrary.tabs.myLibrary')}
            </button>
          </div>

          {(activeTab === 'user' || isAdmin) && (
            <div className="flex items-center gap-3">
              {activeTab === 'default' && isAdmin && (
                <span className="text-[10px] text-yellow-500 font-medium">
                  {t('modal:imageLibrary.adminAccess')}
                </span>
              )}
              <label
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2a2a2a] text-gray-300 rounded hover:bg-[#3a3a3a] cursor-pointer transition-colors text-xs font-medium"
                title={`Max ${MAX_FILE_SIZE_MB}MB per file`}
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>{uploading ? t('modal:imageLibrary.uploading') : t('modal:imageLibrary.upload')}</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Admin notice */}
        {isAdmin && activeTab === 'default' && (
          <div className="mx-6 mt-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-[11px] text-yellow-400">
            {t('modal:imageLibrary.adminDbNotice')}
          </div>
        )}

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#333] border-t-indigo-500"></div>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="material-symbols-outlined text-4xl mb-3 text-gray-600">
                {activeTab === 'user' ? 'cloud_upload' : 'photo_library'}
              </span>
              <p className="text-sm">{t(`modal:imageLibrary.${noImagesKey}`)}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {(images as ImageWithUrl[]).map((image) => (
                <button
                  key={image.id}
                  onClick={() => handleSelect(image as DefaultImageWithUrl & UserImageWithUrl)}
                  className="group relative aspect-square rounded-md overflow-hidden border border-[#333] hover:border-indigo-500 transition-all bg-[#222]"
                >
                  <img
                    src={getCachedDisplayUrl(image.storage_path, bucketName)}
                    alt={image.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 text-3xl drop-shadow-lg">
                      add_circle
                    </span>
                  </div>
                  {!('asset_scope' in image) && image.work_series_slug && image.work_number && (
                    <div className="absolute left-2 top-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
                      Premium
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-white">
                    <div className="truncate text-[10px] font-medium">{image.name}</div>
                    {!('asset_scope' in image) && image.work_series_slug && image.work_number && (
                      <div className="truncate text-[9px] text-gray-300">
                        {formatWorkVariantLabel(image)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 px-6 py-3 border-t border-[#333]">
            <button
              onClick={() => setCurrentPage(p => p - 1)}
              disabled={currentPage === 0}
              className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-[#2a2a2a] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>

            {getPageNumbers().map((page, i) =>
              page === '...' ? (
                <span key={`ellipsis-${i}`} className="px-1 text-[11px] text-gray-600">…</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[28px] h-7 px-1.5 rounded text-xs transition-colors ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white font-medium'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2a2a]'
                  }`}
                >
                  {page + 1}
                </button>
              )
            )}

            <button
              onClick={() => setCurrentPage(p => p + 1)}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-[#2a2a2a] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
