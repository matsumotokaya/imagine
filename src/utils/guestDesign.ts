import type { TemplateRecord } from '../types/template';

export const GUEST_STORAGE_KEY = 'banalist_guest_banner';

interface GuestBannerSnapshot {
  template?: {
    id?: string;
  };
}

export const isPremiumTemplate = (template: Pick<TemplateRecord, 'planType'>) =>
  (template.planType || 'free') === 'premium';

export const readGuestBannerSnapshot = (): GuestBannerSnapshot | null => {
  try {
    const stored = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as GuestBannerSnapshot;
  } catch {
    return null;
  }
};

export const hasGuestDesignConflict = (templateId: string): boolean => {
  const snapshot = readGuestBannerSnapshot();
  const currentTemplateId = snapshot?.template?.id;
  return Boolean(currentTemplateId && currentTemplateId !== templateId);
};
