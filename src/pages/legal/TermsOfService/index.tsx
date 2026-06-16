import { useTranslation } from 'react-i18next';
import { EnglishContent } from './content/EnglishContent';
import { JapaneseContent } from './content/JapaneseContent';
import { KoreanContent } from './content/KoreanContent';
import { ChineseSimplifiedContent } from './content/ChineseSimplifiedContent';
import { ChineseTraditionalContent } from './content/ChineseTraditionalContent';
import { PublicPageLayout } from '../../../components/PublicPageLayout';
import { resolvePageLanguage } from '../../../utils/pageLanguage';

export function TermsOfService() {
  const { i18n } = useTranslation();
  const pageLanguage = resolvePageLanguage(i18n.resolvedLanguage ?? i18n.language);

  const content = {
    en: <EnglishContent />,
    ja: <JapaneseContent />,
    ko: <KoreanContent />,
    'zh-CN': <ChineseSimplifiedContent />,
    'zh-TW': <ChineseTraditionalContent />,
  }[pageLanguage];

  const title = {
    en: 'Terms of Service',
    ja: '利用規約',
    ko: '이용 약관',
    'zh-CN': '服务条款',
    'zh-TW': '服務條款',
  }[pageLanguage];

  const lastUpdated = {
    en: 'Last Updated: February 8, 2026',
    ja: '最終更新日: 2026年2月8日',
    ko: '최종 업데이트: 2026년 2월 8일',
    'zh-CN': '最后更新: 2026年2月8日',
    'zh-TW': '最後更新: 2026年2月8日',
  }[pageLanguage];

  return (
    <PublicPageLayout title={title} description={lastUpdated} contentClassName="space-y-6">
      {content}
    </PublicPageLayout>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}
