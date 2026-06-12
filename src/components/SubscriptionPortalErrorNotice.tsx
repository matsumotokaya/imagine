import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubscriptionPortalErrorDetails } from '../utils/subscription';

interface SubscriptionPortalErrorNoticeProps {
  error: SubscriptionPortalErrorDetails;
  className?: string;
}

export const SubscriptionPortalErrorNotice = ({
  error,
  className,
}: SubscriptionPortalErrorNoticeProps) => {
  const { t } = useTranslation(['auth', 'common']);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (copyError) {
      console.error('Failed to copy subscription portal error details:', copyError);
    }
  };

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 p-3 text-red-900 ${className ?? ''}`}>
      <p className="text-sm font-semibold">
        {t('auth:mypage.portalErrorTitle')}
      </p>
      <p className="mt-1 text-sm text-red-800">
        {error.message}
      </p>
      <p className="mt-2 text-xs text-red-700">
        {t('auth:mypage.portalErrorHelp')}
      </p>
      <div className="mt-3 rounded-md border border-red-200 bg-white p-2">
        <pre className="overflow-x-auto text-xs text-red-900 tabular-nums whitespace-pre-wrap">
          {error.copyText}
        </pre>
      </div>
      <button
        type="button"
        onClick={handleCopy}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-900 transition-colors hover:bg-red-100"
        aria-label={t('auth:mypage.copyPortalError')}
      >
        <span className="material-symbols-outlined text-[16px]">content_copy</span>
        <span>
          {copied ? t('auth:mypage.portalErrorCopied') : t('auth:mypage.copyPortalError')}
        </span>
      </button>
    </div>
  );
};
