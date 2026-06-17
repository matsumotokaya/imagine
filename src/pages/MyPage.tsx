import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { SubscriptionPortalErrorNotice } from '../components/SubscriptionPortalErrorNotice';
import {
  createPortalSessionUrl,
  isSubscriptionPortalSessionRecoveryError,
  SubscriptionPortalError,
  type SubscriptionPortalErrorDetails,
} from '../utils/subscription';
import { Footer } from '../components/Footer';

export function MyPage() {
  const { t } = useTranslation(['auth', 'common', 'message']);
  const { user, session, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<SubscriptionPortalErrorDetails | null>(null);

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isPremium = profile?.subscriptionTier === 'premium';
  const isCanceling = profile?.subscriptionStatus === 'canceling';

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setPortalError(null);
    try {
      window.location.href = await createPortalSessionUrl(session?.access_token);
    } catch (error) {
      console.error('Unexpected error creating portal session:', error);
      if (isSubscriptionPortalSessionRecoveryError(error)) {
        await signOut();
        navigate('/auth?reason=session-expired&redirect=%2Fmypage', { replace: true });
        return;
      }
      if (error instanceof SubscriptionPortalError) {
        setPortalError(error.details);
      } else {
        setPortalError({
          code: 'SubscriptionPortalUnknownError',
          message: t('message:error.subscriptionPortalFailed'),
          copyText: [
            'error_code=SubscriptionPortalUnknownError',
            'status=n/a',
            'error_id=n/a',
            `message=${error instanceof Error ? error.message : t('message:error.subscriptionPortalFailed')}`,
          ].join('\n'),
        });
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-dvh bg-gray-50 flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            &larr; {t('common:button.backToHome')}
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('auth:mypage.title')}
          </h1>
        </div>

        {/* Profile Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('auth:mypage.profileSection')}
          </h2>
          <div className="flex items-center gap-4">
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt="Avatar"
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-medium text-2xl">
                {(profile?.email || user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 text-lg truncate">
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
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('auth:mypage.subscriptionSection')}
          </h2>

          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-gray-500">{t('auth:mypage.currentPlan')}</span>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isPremium
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {isPremium ? t('auth:premium') : t('auth:free')}
            </span>
          </div>

          {isPremium ? (
            <div>
              {isCanceling && profile?.subscriptionExpiresAt && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-orange-900 mb-1">
                        {t('auth:mypage.cancelingTitle')}
                      </h3>
                      <p className="text-sm text-orange-800">
                        {t('auth:mypage.cancelingDescription', { date: formatDate(profile.subscriptionExpiresAt) })}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-3">
                {t('auth:mypage.premiumDescription')}
              </p>
              {profile?.subscriptionExpiresAt && (
                <p className="text-sm text-gray-500 mb-4">
                  {isCanceling ? t('auth:mypage.accessUntil') : t('auth:mypage.expiresAt')}: {formatDate(profile.subscriptionExpiresAt)}
                </p>
              )}
              <div>
                <button
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {portalLoading ? t('common:label.loading') : t('auth:mypage.manageSubscription')}
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  {t('auth:mypage.cancelNote')}
                </p>
                {portalError && (
                  <SubscriptionPortalErrorNotice error={portalError} className="mt-3" />
                )}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-4">
                {t('auth:mypage.freeDescription')}
              </p>
              <Link
                to="/upgrade"
                className="inline-flex px-5 py-2.5 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-700 text-white text-sm font-bold rounded-lg transition-all shadow-lg hover:shadow-xl"
              >
                {t('auth:mypage.upgradeToPremium')}
              </Link>
            </div>
          )}
        </div>

        {/* Account Section */}
        {profile?.role === 'admin' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Admin Tools
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                to="/admin"
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="text-sm font-semibold text-gray-900">Admin Dashboard</div>
                <p className="mt-2 text-sm text-gray-500 text-pretty">
                  ストレージ、登録者数、テンプレート数を確認する。
                </p>
              </Link>
              <Link
                to="/admin/content-factory"
                className="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="text-sm font-semibold text-gray-900">Content Factory</div>
                <p className="mt-2 text-sm text-gray-500 text-pretty">
                  公式作品の制作フローと壁紙出力方針を管理する。
                </p>
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('auth:mypage.accountSection')}
          </h2>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('auth:logout')}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
