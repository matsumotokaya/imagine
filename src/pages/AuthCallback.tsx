import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getSupabase } from '../utils/supabase';

function readAuthNextCookie() {
  const raw = document.cookie
    .split('; ')
    .find((part) => part.startsWith('whatif_auth_next='))
    ?.split('=')
    .slice(1)
    .join('=');

  if (!raw) {
    return null;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function clearAuthNextCookie() {
  document.cookie = 'whatif_auth_next=; Path=/; Max-Age=0; SameSite=Lax';
}

export const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || readAuthNextCookie() || '/';

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;
    let timeout = 0;

    const handleCallback = async () => {
      const supabase = await getSupabase();

      if (!isActive) {
        return;
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          navigate('/auth?view=update-password', { replace: true });
          return;
        }

        if (session) {
          clearAuthNextCookie();
          navigate(redirect, { replace: true });
        } else {
          navigate('/auth?error=callback_failed', { replace: true });
        }
      });

      unsubscribe = () => subscription.unsubscribe();

      timeout = window.setTimeout(() => {
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (!isActive) {
            return;
          }

          if (session) {
            clearAuthNextCookie();
            navigate(redirect, { replace: true });
          } else {
            navigate('/auth?error=callback_failed', { replace: true });
          }
        });
      }, 3000);
    };

    void handleCallback();

    return () => {
      isActive = false;
      unsubscribe?.();
      clearTimeout(timeout);
    };
  }, [navigate, redirect]);

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
};
