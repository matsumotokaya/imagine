import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { bannerStorage } from '../utils/bannerStorage';
import { templateStorage } from '../utils/templateStorage';
import { hasGuestDesignConflict, isPremiumTemplate } from '../utils/guestDesign';
import { invalidateBannerCollectionQueries } from './useBanners';
import { DEFAULT_TEMPLATES } from '../templates/defaultTemplates';
import type { Template, TemplateRecord } from '../types/template';

function buildEditorTemplate(template: TemplateRecord): Template {
  const fallbackTemplate = DEFAULT_TEMPLATES[0];
  return {
    id: template.id,
    name: template.name,
    width: template.width ?? fallbackTemplate.width,
    height: template.height ?? fallbackTemplate.height,
    backgroundColor: template.canvasColor,
    thumbnail: template.thumbnailUrl,
    planType: template.planType,
  };
}

interface UseOpenTemplateOptions {
  // Shown when a guest or free user opens a premium template.
  onUpgradeRequired: () => void;
  // Shown when a guest already has a different in-progress guest design.
  onGuestConflict: (template: TemplateRecord) => void;
  // Toggles the per-card "creating..." spinner (no-op when not needed).
  onCreatingChange?: (templateId: string | null) => void;
}

// Shared template-open flow used by both TemplateGallery cards and the
// /banner?template=<id> direct-open receiver. Mirrors the original
// handleTemplateClick: getById resolution + premium guard + login/guest branch.
export function useOpenTemplate(options: UseOpenTemplateOptions) {
  const { onUpgradeRequired, onGuestConflict, onCreatingChange } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(['banner']);
  const { user, profile } = useAuth();
  const isGuest = !user;

  return useCallback(
    async (template: TemplateRecord) => {
      const resolvedTemplate = template.elements
        ? template
        : await templateStorage.getById(template.id);
      if (!resolvedTemplate?.elements) {
        alert(t('banner:templateLoadFailed'));
        return;
      }

      const guestAllowed = !isPremiumTemplate(resolvedTemplate);
      if (isGuest && !guestAllowed) {
        onUpgradeRequired();
        return;
      }

      if (isPremiumTemplate(resolvedTemplate)) {
        if (!user || !profile || profile.subscriptionTier === 'free') {
          onUpgradeRequired();
          return;
        }
      }

      // Fire-and-forget: increment open count
      templateStorage.incrementOpenCount(resolvedTemplate.id);

      const editorTemplate = buildEditorTemplate(resolvedTemplate);
      const templateElements = JSON.parse(JSON.stringify(resolvedTemplate.elements || []));

      if (!user) {
        if (hasGuestDesignConflict(resolvedTemplate.id)) {
          onGuestConflict(resolvedTemplate);
          return;
        }

        navigate('/banner', {
          state: {
            template: editorTemplate,
            elements: templateElements,
            canvasColor: resolvedTemplate.canvasColor,
            name: resolvedTemplate.name,
            templateId: resolvedTemplate.id,
          },
        });
        return;
      }

      onCreatingChange?.(resolvedTemplate.id);
      try {
        const created = await bannerStorage.createFromTemplate(resolvedTemplate, editorTemplate);
        if (created) {
          await invalidateBannerCollectionQueries(queryClient);
          navigate(`/banner/${created.id}`);
        }
      } finally {
        onCreatingChange?.(null);
      }
    },
    [navigate, queryClient, t, user, profile, isGuest, onUpgradeRequired, onGuestConflict, onCreatingChange],
  );
}
