import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '../utils/supabase';

export interface AdminStats {
  totalUsers: number;
  premiumUsers: number;
  totalBanners: number;
  totalTemplates: number;
  userImagesBytes: number;
  defaultImagesBytes: number;
  totalUserImages: number;
  totalDefaultImages: number;
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

  return {
    totalUsers: data.total_users ?? 0,
    premiumUsers: data.premium_users ?? 0,
    totalBanners: data.total_banners ?? 0,
    totalTemplates: data.total_templates ?? 0,
    userImagesBytes: data.user_images_bytes ?? 0,
    defaultImagesBytes: data.default_images_bytes ?? 0,
    totalUserImages: data.total_user_images ?? 0,
    totalDefaultImages: data.total_default_images ?? 0,
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
