import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSessionUrl } from '../utils/subscription';

export const UpgradePage = () => {
  const { t } = useTranslation(['modal', 'auth', 'message', 'common']);
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const isPremium = profile?.subscriptionTier === 'premium';

  const handleUpgrade = async () => {
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent('/upgrade')}`);
      return;
    }

    if (isPremium) {
      navigate('/mypage');
      return;
    }

    setLoading(true);
    try {
      const url = await createCheckoutSessionUrl(user.id);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to start upgrade checkout:', error);
      alert(t('message:error.upgradeError'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101010] flex flex-col">
      <Header />

      <main className="flex-1 px-6 py-10 md:py-16">
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-[#2c2c2c] bg-[#171717] shadow-2xl">
          <div className="bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 px-8 py-10 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
              {t('modal:upgrade.title')}
            </h1>
            <p className="text-white/90 text-sm md:text-base">
              {t('modal:upgrade.description')}
            </p>
          </div>

          <div className="px-8 py-8 md:px-10 md:py-10">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-gray-700 bg-[#1f1f1f] p-4">
                <p className="text-sm font-semibold text-white">
                  {t('modal:upgrade.features.access.title')}
                </p>
                <p className="mt-1 text-xs leading-6 text-gray-400">
                  {t('modal:upgrade.features.access.desc')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-[#1f1f1f] p-4">
                <p className="text-sm font-semibold text-white">
                  {t('modal:upgrade.features.support.title')}
                </p>
                <p className="mt-1 text-xs leading-6 text-gray-400">
                  {t('modal:upgrade.features.support.desc')}
                </p>
              </div>
              <div className="rounded-xl border border-gray-700 bg-[#1f1f1f] p-4">
                <p className="text-sm font-semibold text-white">
                  {t('modal:upgrade.features.earlyAccess.title')}
                </p>
                <p className="mt-1 text-xs leading-6 text-gray-400">
                  {t('modal:upgrade.features.earlyAccess.desc')}
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-gray-700 bg-[#111111] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">{t('auth:mypage.currentPlan')}</span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      isPremium
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-700 text-gray-100'
                    }`}
                  >
                    {isPremium ? t('auth:premium') : t('auth:free')}
                  </span>
                </div>
                <Link to="/mypage" className="text-sm text-gray-400 underline hover:text-white">
                  {t('auth:mypage.title')}
                </Link>
              </div>

              <p className="mt-3 text-sm text-gray-300">
                {isPremium
                  ? t('auth:mypage.premiumDescription')
                  : t('auth:mypage.freeDescription')}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 px-7 py-3 text-sm font-bold text-white transition-all hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? t('common:status.loading') : isPremium ? t('auth:mypage.manageSubscription') : t('modal:upgrade.upgradeButton')}
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-lg border border-gray-600 px-7 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/10"
              >
                {t('common:button.backToHome')}
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
