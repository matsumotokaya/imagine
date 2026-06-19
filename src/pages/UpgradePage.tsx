import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { createCheckoutSessionUrl } from '../utils/subscription';
import { cn } from '../utils/cn';

function resolveReturnTarget(rawTarget: string | null) {
  if (!rawTarget) {
    return null;
  }

  try {
    const url = new URL(rawTarget, window.location.origin);
    const allowedOrigins = new Set([
      window.location.origin,
      'https://whatif-ep.xyz',
      'https://app.whatif-ep.xyz',
      'http://localhost:3710',
      'http://localhost:5173',
    ]);

    if (!allowedOrigins.has(url.origin)) {
      return null;
    }

    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function openTarget(navigate: ReturnType<typeof useNavigate>, target: string) {
  if (/^https?:\/\//i.test(target)) {
    window.location.href = target;
    return;
  }

  navigate(target);
}

function CheckIcon({ accentClassName }: { accentClassName: string }) {
  return (
    <svg className={cn('mt-0.5 size-4 flex-shrink-0', accentClassName)} fill="currentColor" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface PlanCardProps {
  title: string;
  description: string;
  priceLabel: string;
  badgeLabel?: string | null;
  accentClassName: string;
  shellClassName: string;
  buttonClassName: string;
  buttonLabel: string;
  disabled?: boolean;
  onClick: () => void;
  features: string[];
  secondaryAction?: React.ReactNode;
}

function PlanCard({
  title,
  description,
  priceLabel,
  badgeLabel,
  accentClassName,
  shellClassName,
  buttonClassName,
  buttonLabel,
  disabled = false,
  onClick,
  features,
  secondaryAction,
}: PlanCardProps) {
  return (
    <section className={cn('flex h-full flex-col rounded-[28px] border p-6 sm:p-7', shellClassName)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn('text-xl font-semibold text-balance', accentClassName)}>{title}</h2>
          <p className="mt-3 text-sm leading-6 text-pretty text-gray-300">{description}</p>
        </div>
        {badgeLabel ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
            {badgeLabel}
          </span>
        ) : null}
      </div>

      <p className="mt-6 text-3xl font-bold tabular-nums text-white">{priceLabel}</p>

      <ul className="mt-6 space-y-3 text-sm text-gray-200">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <CheckIcon accentClassName={accentClassName} />
            <span className="text-pretty">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            buttonClassName,
          )}
        >
          {buttonLabel}
        </button>
        {secondaryAction}
      </div>
    </section>
  );
}

export const UpgradePage = () => {
  const { t } = useTranslation(['auth', 'modal', 'message', 'common']);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, session, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const returnTarget = useMemo(
    () => resolveReturnTarget(searchParams.get('return_to')),
    [searchParams],
  );
  const fromGallery = searchParams.get('source') === 'gallery';
  const currentPath = `${location.pathname}${location.search}`;
  const isPremium = profile?.subscriptionTier === 'premium';

  const guestFeatures = [
    t('auth:guestDescription'),
    t('modal:upgrade.freePlan.feat1Desc'),
  ];
  const freeFeatures = [
    t('auth:memberDescription'),
    t('modal:upgrade.freePlan.feat2Desc'),
  ];
  const premiumFeatures = [
    t('modal:upgrade.features.access.desc'),
    t('modal:upgrade.features.theClub.desc'),
    t('modal:upgrade.features.support.desc'),
    t('modal:upgrade.features.earlyAccess.desc'),
  ];

  const handleGuestContinue = () => {
    if (returnTarget) {
      openTarget(navigate, returnTarget);
      return;
    }

    navigate('/');
  };

  const handleFreePlan = () => {
    if (user) {
      navigate('/');
      return;
    }

    navigate(`/auth?tab=signup&redirect=${encodeURIComponent('/')}`);
  };

  const handlePremiumPlan = async () => {
    if (!user) {
      navigate(`/auth?tab=signup&redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (isPremium) {
      openTarget(navigate, returnTarget ?? '/mypage');
      return;
    }

    setLoading(true);

    try {
      const successPath = returnTarget
        ? `/success?return_to=${encodeURIComponent(returnTarget)}`
        : '/success';
      const url = await createCheckoutSessionUrl(user.id, session?.access_token, {
        successPath,
        cancelPath: currentPath,
      });
      window.location.href = url;
    } catch (error) {
      console.error('Failed to start upgrade checkout:', error);
      alert(t('message:error.upgradeError'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Header />

      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-[32px] border border-[#2a2a2a] bg-[#161616] px-6 py-8 sm:px-8 sm:py-10">
            <p className="text-sm text-gray-400">{t('auth:serviceEyebrow')}</p>
            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h1 className="text-4xl font-bold text-balance text-white sm:text-5xl">
                  {t('auth:plansTitle')}
                </h1>
                <p className="mt-4 text-base leading-7 text-pretty text-gray-300">
                  {t('auth:plansDescription')}
                </p>
              </div>

              {fromGallery ? (
                <div className="rounded-2xl border border-[#3c3320] bg-[#211b10] px-5 py-4 text-sm leading-6 text-pretty text-[#f5d38a]">
                  {t('auth:plansGalleryDescription')}
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            <PlanCard
              title={t('auth:guestTitle')}
              description={t('auth:guestDescription')}
              priceLabel="$0"
              accentClassName="text-white"
              shellClassName="border-[#2b2b2b] bg-[#161616]"
              buttonClassName="bg-[#252525] text-white hover:bg-[#303030]"
              buttonLabel={returnTarget ? t('auth:returnToGallery') : t('auth:continueAsGuest')}
              onClick={handleGuestContinue}
              features={guestFeatures}
            />

            <PlanCard
              title={t('auth:memberTitle')}
              description={t('auth:memberDescription')}
              priceLabel="$0"
              badgeLabel={user && !isPremium ? t('modal:upgrade.freePlan.active') : null}
              accentClassName="text-white"
              shellClassName="border-[#2b2b2b] bg-[#1b1b1b]"
              buttonClassName="bg-indigo-600 text-white hover:bg-indigo-500"
              buttonLabel={user ? t('auth:continueWithFreePlan') : t('auth:startFreePlan')}
              onClick={handleFreePlan}
              features={freeFeatures}
              secondaryAction={!user ? (
                <Link
                  to={`/auth?redirect=${encodeURIComponent(currentPath)}`}
                  className="block text-center text-sm text-gray-400 transition-colors hover:text-white"
                >
                  {t('auth:alreadyHaveAccount')} {t('auth:login')}
                </Link>
              ) : null}
            />

            <PlanCard
              title={t('auth:premiumMemberTitle')}
              description={t('auth:premiumMemberDescription')}
              priceLabel="$3 / month"
              badgeLabel={isPremium ? t('common:label.current') : null}
              accentClassName="text-[#f5d38a]"
              shellClassName="border-[#3c3320] bg-[#211b10]"
              buttonClassName="bg-[#f5d38a] text-[#1b1409] hover:bg-[#f0ca73]"
              buttonLabel={
                isPremium
                  ? t('auth:mypage.manageSubscription')
                  : loading
                    ? t('common:status.loading')
                    : t('modal:upgrade.upgradeButton')
              }
              disabled={loading}
              onClick={() => void handlePremiumPlan()}
              features={premiumFeatures}
            />
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};
