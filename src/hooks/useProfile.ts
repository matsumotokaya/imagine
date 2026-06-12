import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '../utils/supabase';

interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  role: 'admin' | 'user';
  subscriptionTier: 'free' | 'premium';
  subscriptionExpiresAt?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: 'active' | 'canceling' | 'canceled' | null;
}

// Query keys
export const profileKeys = {
  all: ['profiles'] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};

// Fetch profile from Supabase
async function fetchProfile(userId: string): Promise<UserProfile> {
  try {
    console.log('[useProfile] Fetching profile from Supabase for userId:', userId);
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, role, subscription_tier, subscription_expires_at, stripe_customer_id, subscription_status')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[useProfile] Error fetching profile:', error);
      return {
        id: userId,
        email: '',
        role: 'user' as const,
        subscriptionTier: 'free' as const,
      };
    }

    console.log('[useProfile] Profile fetched successfully:', data);

    const userProfile: UserProfile = {
      id: data.id,
      email: data.email || '',
      fullName: data.full_name || undefined,
      avatarUrl: data.avatar_url || undefined,
      role: (data.role || 'user') as 'admin' | 'user',
      subscriptionTier: (data.subscription_tier || 'free') as 'free' | 'premium',
      subscriptionExpiresAt: data.subscription_expires_at || undefined,
      stripeCustomerId: data.stripe_customer_id || undefined,
      subscriptionStatus: data.subscription_status as 'active' | 'canceling' | 'canceled' | null || null,
    };

    return userProfile;
  } catch (err) {
    console.error('[useProfile] Exception fetching profile:', err);
    return {
      id: userId,
      email: '',
      role: 'user' as const,
      subscriptionTier: 'free' as const,
    };
  }
}

// Hook to get user profile
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: profileKeys.detail(userId || ''),
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: 0, // Always fetch fresh data
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    retry: 2,
  });
}
