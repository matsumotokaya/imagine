import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSessionUrl } from '../utils/subscription';

const CheckIcon = () => (
  <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const GoldCheckIcon = () => (
  <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

export const UpgradePage = () => {
  const { t } = useTranslation(['modal', 'auth', 'message', 'common']);
  const navigate = useNavigate();
  const { user, session, profile } = useAuth();
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
      const url = await createCheckoutSessionUrl(user.id, session?.access_token);
      window.location.href = url;
    } catch (error) {
      console.error('Failed to start upgrade checkout:', error);
      alert(t('message:error.upgradeError'));
      setLoading(false);
    }
  };

  const freeFeatures = [
    { title: t('modal:upgrade.freePlan.feat1Title'), desc: t('modal:upgrade.freePlan.feat1Desc') },
    { title: t('modal:upgrade.freePlan.feat2Title'), desc: t('modal:upgrade.freePlan.feat2Desc') },
    { title: t('modal:upgrade.freePlan.feat3Title'), desc: t('modal:upgrade.freePlan.feat3Desc') },
  ];

  const premiumFeatures = [
    { title: t('modal:upgrade.features.access.title'), desc: t('modal:upgrade.features.access.desc') },
    { title: t('modal:upgrade.features.theClub.title'), desc: t('modal:upgrade.features.theClub.desc') },
    { title: t('modal:upgrade.features.support.title'), desc: t('modal:upgrade.features.support.desc') },
    { title: t('modal:upgrade.features.earlyAccess.title'), desc: t('modal:upgrade.features.earlyAccess.desc') },
  ];

  return (
    <div className="min-h-screen bg-[#101010] flex flex-col">
      <Header />

      <main className="flex-1 px-6 py-10 md:py-16">
        <div className="mx-auto w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {t('auth:mypage.subscriptionSection')}
            </h1>
            <p className="text-sm text-gray-400">
              {t('modal:upgrade.description')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Free Plan */}
            <div className={`rounded-2xl border p-6 flex flex-col ${
              !isPremium
                ? 'border-indigo-500/50 bg-[#171720]'
                : 'border-[#2c2c2c] bg-[#171717]'
            }`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                  {t('modal:upgrade.freePlan.name')}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">{t('modal:upgrade.freePlan.price')}</span>
                  <span className="text-gray-400 text-sm mb-1">/ month</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{t('modal:upgrade.freePlan.billing')}</p>
              </div>

              <button
                disabled
                className={`w-full mt-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  !isPremium
                    ? 'bg-indigo-600 text-white cursor-default'
                    : 'bg-[#252525] text-gray-500 cursor-default'
                }`}
              >
                {t('modal:upgrade.freePlan.active')}
              </button>

              <div className="mt-6 space-y-3.5 flex-1">
                {freeFeatures.map((f) => (
                  <div key={f.title} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <div>
                      <p className="text-sm text-gray-200">{f.title}</p>
                      <p className="text-xs text-gray-500">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Premium Plan */}
            <div className={`rounded-2xl border p-6 flex flex-col ${
              isPremium
                ? 'border-amber-500/50 bg-[#1a1710]'
                : 'border-amber-500/20 bg-[#1a1710]'
            }`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">
                  {t('modal:upgrade.premiumPlan.name')}
                </p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">{t('modal:upgrade.premiumPlan.price')}</span>
                  <span className="text-gray-400 text-sm mb-1">/ month</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{t('modal:upgrade.premiumPlan.billing')}</p>
              </div>

              {isPremium ? (
                <button
                  disabled
                  className="w-full mt-5 py-2.5 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-400 cursor-default"
                >
                  {t('modal:upgrade.freePlan.active')}
                </button>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full mt-5 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-500 hover:via-amber-600 hover:to-yellow-700 text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t('common:status.loading') : t('modal:upgrade.premiumPlan.upgradeButton')}
                </button>
              )}

              <div className="mt-6 space-y-3.5 flex-1">
                {premiumFeatures.map((f) => (
                  <div key={f.title} className="flex items-start gap-2.5">
                    <GoldCheckIcon />
                    <div>
                      <p className="text-sm text-gray-200">{f.title}</p>
                      <p className="text-xs text-gray-500">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              to="/"
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t('common:button.backToHome')}
            </Link>
            {user && (
              <>
                <span className="text-gray-700">·</span>
                <Link
                  to="/mypage"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {t('auth:mypage.title')}
                </Link>
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
