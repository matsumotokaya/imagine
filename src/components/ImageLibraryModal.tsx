import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../utils/supabase';
import type { DefaultImage, UserImage } from '../types/image-library';

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (url: string, width: number, height: number) => void;
  initialTab?: 'default' | 'user';
}

type TabType = 'default' | 'user';

// Extended types with display URL
type DefaultImageWithUrl = DefaultImage & { displayUrl?: string };
type UserImageWithUrl = UserImage & { displayUrl?: string };

type ImageWithUrl = DefaultImageWithUrl | UserImageWithUrl;
const PAGE_SIZE = 72;
const PREVIEW_SIZE_PX = 256;
const PREVIEW_QUALITY = 60;

export const ImageLibraryModal = ({ isOpen, onClose, onSelectImage, initialTab = 'user' }: ImageLibraryModalProps) => {
  const { t } = useTranslation(['modal', 'message']);
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [defaultImages, setDefaultImages] = useState<DefaultImageWithUrl[]>([]);
  const [userImages, setUserImages] = useState<UserImageWithUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasMoreDefault, setHasMoreDefault] = useState(true);
  const [hasMoreUser, setHasMoreUser] = useState(true);

  // Cache for image URLs
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch default images (paged)
  const fetchDefaultImages = useCallback(async (reset = false) => {
    if (!reset && (!hasMoreDefault || loading || loadingMore)) return;

    const offset = reset ? 0 : defaultImages.length;
    const to = offset + PAGE_SIZE - 1;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const { data, error } = await supabase
      .from('default_images')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, to);

    if (error) {
      console.error('Error fetching default images:', error);
      if (reset) setDefaultImages([]);
      setHasMoreDefault(false);
    } else if (data) {
      setDefaultImages(prev => (reset ? data : [...prev, ...data]));
      setHasMoreDefault(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [defaultImages.length, hasMoreDefault, loading, loadingMore]);

  // Fetch user images (paged)
  const fetchUserImages = useCallback(async (reset = false) => {
    if (!reset && (!hasMoreUser || loading || loadingMore)) return;

    const offset = reset ? 0 : userImages.length;
    const to = offset + PAGE_SIZE - 1;
    if (reset) setLoading(true);
    else setLoadingMore(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      setLoadingMore(false);
      setHasMoreUser(false);
      setUserImages([]);
      return;
    }

    const { data, error } = await supabase
      .from('user_images')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, to);

    if (error) {
      console.error('Error fetching user images:', error);
      if (reset) setUserImages([]);
      setHasMoreUser(false);
    } else if (data) {
      setUserImages(prev => (reset ? data : [...prev, ...data]));
      setHasMoreUser(data.length === PAGE_SIZE);
    }
    setLoading(false);
    setLoadingMore(false);
  }, [hasMoreUser, loading, loadingMore, userImages.length]);

  // Check if current user is admin by querying profiles table
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

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

  // Set initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Load images when modal opens or tab changes
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'default') {
        fetchDefaultImages(true);
      } else {
        fetchUserImages(true);
      }
    }
  }, [isOpen, activeTab, fetchDefaultImages, fetchUserImages]);

  // Infinite scroll: load next page when sentinel enters viewport
  useEffect(() => {
    if (!isOpen || loading || loadingMore) return;

    const root = scrollContainerRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel) return;

    const hasMore = activeTab === 'default' ? hasMoreDefault : hasMoreUser;
    if (!hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (activeTab === 'default') {
          fetchDefaultImages(false);
        } else {
          fetchUserImages(false);
        }
      },
      {
        root,
        rootMargin: '160px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    activeTab,
    fetchDefaultImages,
    fetchUserImages,
    hasMoreDefault,
    hasMoreUser,
    isOpen,
    loading,
    loadingMore,
  ]);

  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  // Handle file upload (works for both default and user images)
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

            const { error: uploadError } = await supabase.storage
              .from('default-images')
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
              .from('default_images')
              .insert({
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

            const { error: uploadError } = await supabase.storage
              .from('user-images')
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
              .from('user_images')
              .insert({
                user_id: user.id,
                name: file.name,
                storage_path: filePath,
                width,
                height,
                file_size: file.size,
              });

            if (dbError) throw dbError;
          }

          successCount++;
        } catch (error) {
          console.error('Error uploading file:', file.name, error);
          failCount++;
        }
      }

      if (activeTab === 'default') await fetchDefaultImages(true);
      else await fetchUserImages(true);

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

  // Get cached display URL for thumbnail preview
  const getCachedDisplayUrl = (storagePath: string, bucketName: 'default-images' | 'user-images'): string => {
    const cacheKey = `${bucketName}:${storagePath}:preview`;

    if (urlCacheRef.current.has(cacheKey)) {
      return urlCacheRef.current.get(cacheKey)!;
    }

    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath, {
      transform: {
        width: PREVIEW_SIZE_PX,
        height: PREVIEW_SIZE_PX,
        resize: 'contain',
        quality: PREVIEW_QUALITY,
      },
    });
    const publicUrl = data.publicUrl;
    urlCacheRef.current.set(cacheKey, publicUrl);

    return publicUrl;
  };

  // Get permanent public URL for canvas
  const getPublicUrl = (storagePath: string, bucketName: 'default-images' | 'user-images'): string => {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
    return data.publicUrl;
  };

  // Handle image selection
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
  const hasMore = activeTab === 'default' ? hasMoreDefault : hasMoreUser;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <h2 className="text-base font-semibold text-gray-100">{t('modal:imageLibrary.title')}</h2>
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
              onClick={() => setActiveTab('default')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                activeTab === 'default'
                  ? 'bg-[#2b2b2b] text-gray-100'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t('modal:imageLibrary.tabs.default')}
            </button>
            <button
              onClick={() => setActiveTab('user')}
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
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-4">
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
            <>
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
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-[10px] px-2 py-1.5 truncate">
                        {image.name}
                      </div>
                    </button>
                  ))}
              </div>
              <div ref={loadMoreSentinelRef} className="h-4" />
              {loadingMore && (
                <div className="py-3 flex items-center justify-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#333] border-t-indigo-500"></div>
                </div>
              )}
              {!hasMore && images.length > 0 && (
                <div className="py-2 text-center text-[11px] text-gray-500">
                  End of library
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
