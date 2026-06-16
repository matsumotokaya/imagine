import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnglishContent } from './content/EnglishContent';
import { JapaneseContent } from './content/JapaneseContent';
import { KoreanContent } from './content/KoreanContent';
import { ChineseSimplifiedContent } from './content/ChineseSimplifiedContent';
import { ChineseTraditionalContent } from './content/ChineseTraditionalContent';
import { PublicPageLayout } from '../../components/PublicPageLayout';
import { resolvePageLanguage } from '../../utils/pageLanguage';

export function AboutUs() {
  const { i18n } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const pageLanguage = resolvePageLanguage(i18n.resolvedLanguage ?? i18n.language);

  const ContentComponent = {
    'en': EnglishContent,
    'ja': JapaneseContent,
    'ko': KoreanContent,
    'zh-CN': ChineseSimplifiedContent,
    'zh-TW': ChineseTraditionalContent,
  }[pageLanguage] || EnglishContent;

  const title = {
    en: 'About Us',
    ja: 'サービスについて',
    ko: '서비스 소개',
    'zh-CN': '关于我们',
    'zh-TW': '關於我們',
  }[pageLanguage];

  const description = {
    en: 'Learn more about IMAGINE and the creative work behind WHATIF.',
    ja: 'IMAGINE のサービス概要と、WHATIF が制作しているクリエイティブについてご紹介します。',
    ko: 'IMAGINE 서비스 개요와 WHATIF가 제작하는 크리에이티브를 소개합니다.',
    'zh-CN': '介绍 IMAGINE 的服务概要，以及 WHATIF 正在创作的内容。',
    'zh-TW': '介紹 IMAGINE 的服務概要，以及 WHATIF 正在創作的內容。',
  }[pageLanguage];

  return (
    <PublicPageLayout
      title={title}
      description={description}
      maxWidthClassName="max-w-5xl"
      contentClassName="space-y-12 px-6 py-10 md:px-10"
    >
      <ContentComponent
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
      />

      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-7xl">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-2xl text-white hover:text-gray-300"
              aria-label="Close image preview"
            >
              ✕
            </button>
            <img
              src={selectedImage}
              alt="Expanded view"
              className="max-h-[90vh] max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </PublicPageLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-6 last:border-0">
      <h2 className="mb-3 text-xl font-semibold text-gray-900">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export { Section };
