import { getSupabase } from './supabase';
import type { CanvasElement, TemplateRecord } from '../types/template';

interface DbTemplate {
  id: string;
  name: string;
  elements?: CanvasElement[] | null;
  canvas_color: string;
  thumbnail_url: string | null;
  plan_type: 'free' | 'premium' | null;
  display_order?: number | null;
  width?: number | null;
  height?: number | null;
  like_count?: number | null;
  open_count?: number | null;
}

const dbToTemplate = (db: DbTemplate): TemplateRecord => ({
  id: db.id,
  name: db.name,
  elements: db.elements ?? undefined,
  canvasColor: db.canvas_color,
  thumbnailUrl: db.thumbnail_url || undefined,
  planType: db.plan_type || undefined,
  displayOrder: db.display_order ?? undefined,
  width: db.width ?? undefined,
  height: db.height ?? undefined,
  likeCount: db.like_count ?? 0,
  openCount: db.open_count ?? 0,
});

export const templateStorage = {
  async getPublicTemplates(): Promise<TemplateRecord[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('templates')
      .select('id, name, canvas_color, thumbnail_url, plan_type, display_order, width, height, updated_at, like_count, open_count')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return (data || []).map(dbToTemplate);
  },

  async getById(id: string): Promise<TemplateRecord | null> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return data ? dbToTemplate(data) : null;
  },

  async createTemplate(params: {
    name: string;
    elements: CanvasElement[];
    canvasColor: string;
    thumbnailUrl?: string;
    planType: 'free' | 'premium';
    displayOrder?: number;
    width: number;
    height: number;
  }): Promise<string | null> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('templates')
      .insert({
        name: params.name,
        elements: params.elements,
        canvas_color: params.canvasColor,
        thumbnail_url: params.thumbnailUrl || null,
        plan_type: params.planType,
        display_order: params.displayOrder || null,
        width: params.width,
        height: params.height,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating template:', error);
      throw error;
    }

    return data?.id || null;
  },

  // Promote one of a production project's editable drafts into a public template.
  // The Gallery-linked instagram_feed is promoted as `free` (anyone can open it
  // from the Gallery), while the wallpaper-sized portrait_master/landscape_master
  // drafts are promoted as `premium` (premium members can freely edit them).
  // Keyed on (production_project_id, banner_role) so re-publishing the same
  // project upserts each role's template instead of creating duplicates. The
  // mirrored fields match handleTemplateModalSave in BannerEditor.tsx (manual path).
  async upsertTemplateFromProductionProject(params: {
    productionProjectId: string;
    bannerId: string;
    bannerRole: string;
    name: string;
    planType: 'free' | 'premium';
  }): Promise<string | null> {
    const supabase = await getSupabase();

    // The banner row holds elements/canvas_color directly, while width/height
    // live inside the template jsonb (see bannerStorage.ts dbToBannerListItem).
    const { data: banner, error: bannerError } = await supabase
      .from('banners')
      .select('elements, canvas_color, thumbnail_url, template')
      .eq('id', params.bannerId)
      .single();

    if (bannerError || !banner) {
      throw bannerError ?? new Error('Failed to load source banner for template promotion.');
    }

    const template = (banner.template ?? {}) as { width?: number; height?: number };
    if (!template.width || !template.height) {
      throw new Error('Source banner is missing canvas width/height for template promotion.');
    }

    const payload = {
      production_project_id: params.productionProjectId,
      production_banner_role: params.bannerRole,
      name: params.name,
      elements: banner.elements,
      canvas_color: banner.canvas_color,
      thumbnail_url: banner.thumbnail_url || null,
      plan_type: params.planType,
      is_public: true,
      width: template.width,
      height: template.height,
    };

    const { data, error } = await supabase
      .from('templates')
      .upsert(payload, { onConflict: 'production_project_id,production_banner_role' })
      .select('id')
      .single();

    if (error) {
      console.error('Error promoting production project to template:', error);
      throw error;
    }

    return data?.id || null;
  },

  async updateTemplate(
    id: string,
    params: {
      name?: string;
      planType?: 'free' | 'premium';
      displayOrder?: number | null;
    }
  ): Promise<void> {
    const supabase = await getSupabase();
    const updates: Record<string, unknown> = {};
    if (params.name !== undefined) updates.name = params.name;
    if (params.planType !== undefined) updates.plan_type = params.planType;
    if (params.displayOrder !== undefined) updates.display_order = params.displayOrder;

    const { error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  },

  async deleteTemplate(id: string): Promise<void> {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  },

  async incrementOpenCount(templateId: string): Promise<void> {
    const supabase = await getSupabase();
    await supabase.rpc('increment_template_open_count', {
      template_id: templateId,
    });
  },

  async updateDisplayOrders(
    orders: { id: string; displayOrder: number }[]
  ): Promise<void> {
    const supabase = await getSupabase();
    // Update each template's display_order
    const promises = orders.map(({ id, displayOrder }) =>
      supabase
        .from('templates')
        .update({ display_order: displayOrder })
        .eq('id', id)
    );

    const results = await Promise.all(promises);
    const errors = results.filter((r) => r.error);

    if (errors.length > 0) {
      console.error('Error updating display orders:', errors);
      throw new Error('Failed to update display orders');
    }
  },
};
