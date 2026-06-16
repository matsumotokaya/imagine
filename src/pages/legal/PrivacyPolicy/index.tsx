import { useTranslation } from 'react-i18next';
import { EnglishContent } from './content/EnglishContent';
import { JapaneseContent } from './content/JapaneseContent';
import { KoreanContent } from './content/KoreanContent';
import { ChineseSimplifiedContent } from './content/ChineseSimplifiedContent';
import { ChineseTraditionalContent } from './content/ChineseTraditionalContent';
import { PublicPageLayout } from '../../../components/PublicPageLayout';
import { resolvePageLanguage } from '../../../utils/pageLanguage';

export function PrivacyPolicy() {
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
    en: 'Privacy Policy',
    ja: 'プライバシーポリシー',
    ko: '개인정보처리방침',
    'zh-CN': '隐私政策',
    'zh-TW': '隱私權政策',
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
