import { useTranslation } from 'react-i18next';
import { EnglishContent } from './content/EnglishContent';
import { JapaneseContent } from './content/JapaneseContent';
import { KoreanContent } from './content/KoreanContent';
import { ChineseSimplifiedContent } from './content/ChineseSimplifiedContent';
import { ChineseTraditionalContent } from './content/ChineseTraditionalContent';
import { PublicPageLayout } from '../../../components/PublicPageLayout';
import { resolvePageLanguage } from '../../../utils/pageLanguage';

export function Tokushoho() {
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
    en: 'Specified Commercial Transactions Act',
    ja: '特定商取引法に基づく表記',
    ko: '특정상거래법 표기',
    'zh-CN': '特定商业交易法表记',
    'zh-TW': '特定商業交易法表記',
  }[pageLanguage];

  const lastUpdated = {
    en: 'Last Updated: February 15, 2026',
    ja: '最終更新日: 2026年2月15日',
    ko: '최종 업데이트: 2026년 2월 15일',
    'zh-CN': '最后更新: 2026年2月15日',
    'zh-TW': '最後更新: 2026年2月15日',
  }[pageLanguage];

  return (
    <PublicPageLayout title={title} description={lastUpdated} contentClassName="space-y-6">
      {content}
    </PublicPageLayout>
  );
}
