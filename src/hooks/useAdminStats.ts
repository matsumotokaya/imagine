import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '../utils/supabase';

export interface StorageBucket {
  bucketId: string;
  objects: number;
  bytes: number;
}

export interface AdminStats {
  totalUsers: number;
  premiumUsers: number;
  totalBanners: number;
  totalTemplates: number;
  // Library-table figures (file_size recorded in DB rows; excludes thumbnails/derived assets).
  userImagesBytes: number;
  defaultImagesBytes: number;
  totalUserImages: number;
  totalDefaultImages: number;
  // Real measurements (added in the extended get_admin_stats RPC; 0/[] until the migration runs).
  dbSizeBytes: number;
  storageTotalBytes: number;
  storageTotalObjects: number;
  storageBuckets: StorageBucket[];
}

export const adminStatsKeys = {
  all: ['admin-stats'] as const,
};

async function fetchAdminStats(): Promise<AdminStats> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('get_admin_stats');

  if (error) {
    console.error('[useAdminStats] Error fetching admin stats:', error);
    throw error;
  }

  const buckets: StorageBucket[] = Array.isArray(data.storage_buckets)
    ? data.storage_buckets.map((b: { bucket_id: string; objects: number; bytes: number | string }) => ({
        bucketId: b.bucket_id,
        objects: Number(b.objects ?? 0),
        bytes: Number(b.bytes ?? 0),
      }))
    : [];

  return {
    totalUsers: data.total_users ?? 0,
    premiumUsers: data.premium_users ?? 0,
    totalBanners: data.total_banners ?? 0,
    totalTemplates: data.total_templates ?? 0,
    userImagesBytes: data.user_images_bytes ?? 0,
    defaultImagesBytes: data.default_images_bytes ?? 0,
    totalUserImages: data.total_user_images ?? 0,
    totalDefaultImages: data.total_default_images ?? 0,
    dbSizeBytes: Number(data.db_size_bytes ?? 0),
    storageTotalBytes: Number(data.storage_total_bytes ?? 0),
    storageTotalObjects: Number(data.storage_total_objects ?? 0),
    storageBuckets: buckets,
  };
}

export function useAdminStats(userId: string | undefined) {
  return useQuery({
    queryKey: adminStatsKeys.all,
    queryFn: fetchAdminStats,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
}
