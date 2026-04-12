import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

export const AuthButton = () => {
  const { t } = useTranslation(['auth', 'common']);
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const showUpgradeEntry = profile?.subscriptionTier !== 'premium';

  // Debug: Log profile data
  useEffect(() => {
    if (profile) {
      console.log('[AuthButton] Profile data:', profile);
    }
  }, [profile]);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isMenuOpen]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="relative flex items-center" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-9 h-9 rounded-full overflow-hidden hover:ring-2 hover:ring-white/50 transition-all"
        >
          {profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt="User avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-white/20 flex items-center justify-center text-white font-medium">
              {(profile?.email || user.email || 'U')[0].toUpperCase()}
            </div>
          )}
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[80]">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="User avatar"
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-xl">
                    {(profile?.email || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {profile?.fullName || 'User'}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {profile?.email || user.email}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {profile?.role === 'admin' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        {t('auth:admin')}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      profile?.subscriptionTier === 'premium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile?.subscriptionTier === 'premium' ? t('auth:premium') : t('auth:free')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <Link
              to="/mypage"
              onClick={() => setIsMenuOpen(false)}
              className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{t('auth:mypage.title')}</span>
            </Link>

            {showUpgradeEntry && (
              <Link
                to="/upgrade"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-9 7 9M12 6v12" />
                </svg>
                <span>{t('auth:mypage.upgradeToPremium')}</span>
              </Link>
            )}

            {profile?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
              >
                <span className="material-symbols-outlined text-[20px]">monitoring</span>
                <span>Admin Dashboard</span>
              </Link>
            )}

            <button
              onClick={async () => {
                setIsMenuOpen(false);
                await signOut();
                navigate('/');
              }}
              className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t('auth:logout')}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to="/auth"
      className="flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
    >
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span className="hidden md:inline">{t('auth:login')} / {t('auth:signUp')}</span>
      <span className="md:hidden">{t('auth:login')}</span>
    </Link>
  );
};
