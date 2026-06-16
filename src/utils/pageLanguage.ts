export type PageLanguage = 'en' | 'ja' | 'ko' | 'zh-CN' | 'zh-TW';

export function resolvePageLanguage(language?: string | null): PageLanguage {
  const normalized = (language ?? '').toLowerCase();

  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('ko')) return 'ko';

  if (normalized.startsWith('zh')) {
    if (
      normalized.includes('tw') ||
      normalized.includes('hk') ||
      normalized.includes('mo') ||
      normalized.includes('hant')
    ) {
      return 'zh-TW';
    }

    return 'zh-CN';
  }

  return 'en';
}
