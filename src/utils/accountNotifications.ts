import { getSupabase } from './supabase';

export interface SignupNotificationResult {
  sent?: boolean;
  alreadySent?: boolean;
  skipped?: 'email_not_verified' | 'not_recent_signup';
}

export async function notifySignupIfNeeded(
  accessToken?: string,
): Promise<SignupNotificationResult | null> {
  const supabase = await getSupabase();
  const authorization = accessToken
    ? `Bearer ${accessToken}`
    : undefined;

  const { data, error } = await supabase.functions.invoke<SignupNotificationResult>('notify-account-signup', {
    headers: authorization ? { Authorization: authorization } : undefined,
  });

  if (error) {
    console.error('Failed to notify signup event:', error);
    return null;
  }

  return data ?? null;
}
