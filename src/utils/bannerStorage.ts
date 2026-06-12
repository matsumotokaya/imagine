import { getSupabase } from './supabase';
import { cacheManager } from './cacheManager';
import type { Banner, BannerListItem, CanvasElement, Template, TemplateRecord } from '../types/template';
import { uploadDataUrlToBucket } from './storage';

interface DbBanner {
  id: string;
  user_id: string;
  name: string;
  template: Template;
  elements: CanvasElement[];
  canvas_color: string;
  thumbnail_data_url?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

interface DbBannerListItem {
  id: string;
  name: string;
  thumbnail_data_url?: string | null;
  thumbnail_url?: string | null;
  updated_at: string;
  template?: { width?: number; height?: number } | null;
  display_order?: number | null;
}

// Convert DB format to Banner format
const dbToBanner = (db: DbBanner): Banner => ({
  id: db.id,
  name: db.name,
  template: db.template,
  elements: db.elements,
  canvasColor: db.canvas_color,
  thumbnailUrl: db.thumbnail_url || db.thumbnail_data_url || undefined,
  createdAt: db.created_at,
  updatedAt: db.updated_at,
});

const dbToBannerListItem = (db: DbBannerListItem): BannerListItem => ({
  id: db.id,
  name: db.name,
  thumbnailUrl: db.thumbnail_url || db.thumbnail_data_url || undefined,
  updatedAt: db.updated_at,
  width: db.template?.width,
  height: db.template?.height,
  displayOrder: db.display_order ?? undefined,
});

export const bannerStorage = {
  async createFromTemplate(template: TemplateRecord, editorTemplate: Template): Promise<Banner | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Login required');
      return null;
    }

    const elements = JSON.parse(JSON.stringify(template.elements || []));

    const { data, error } = await supabase
      .from('banners')
      .insert({
        user_id: user.id,
        template_id: template.id,
        name: template.name,
        template: editorTemplate,
        elements,
        canvas_color: template.canvasColor,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating banner from template:', error);
      alert('Failed to create banner');
      return null;
    }

    cacheManager.invalidate(`banners:all:${user.id}`);

    return data ? dbToBanner(data) : null;
  },

  // Get all banners (public + own private)
  async getAll(useCache = true): Promise<BannerListItem[]> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return [];
    }

    const cacheKey = user ? `banners:all:${user.id}` : 'banners:public';

    // Check cache first
    if (useCache) {
      const cached = cacheManager.get<Banner[]>(cacheKey);
      if (cached) {
        console.log('✅ Cache hit: banners list');
        return cached;
      }
    }

    // RLS policy handles access control: public banners OR own banners
    const { data, error } = await supabase
      .from('banners')
      .select('id, name, thumbnail_url, updated_at, template, display_order')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching banners:', error);
      return [];
    }

    const banners = (data || []).map(dbToBannerListItem);

    // Cache for 5 minutes
    cacheManager.set(cacheKey, banners, 5 * 60 * 1000);

    return banners;
  },

  // Get banner by ID (public or own)
  async getById(id: string, useCache = true): Promise<Banner | null> {
    const supabase = await getSupabase();
    const cacheKey = `banner:${id}`;

    // Check cache first
    if (useCache) {
      const cached = cacheManager.get<Banner>(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit: banner ${id}`);
        return cached;
      }
    }

    // RLS policy handles access control: public banners OR own banners
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching banner:', error);
      return null;
    }

    const banner = data ? dbToBanner(data) : null;

    if (banner) {
      // Cache for 5 minutes
      cacheManager.set(cacheKey, banner, 5 * 60 * 1000);
    }

    return banner;
  },

  // Create new banner
  async create(name: string, template: Template): Promise<Banner | null> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Login required');
      return null;
    }

    // Create banner with empty elements (no default text)
    const { data, error } = await supabase
      .from('banners')
      .insert({
        user_id: user.id,
        name,
        template,
        elements: [], // Empty array - default elements will be added on client side
        canvas_color: '#FFFFFF',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating banner:', error);
      alert('Failed to create banner');
      return null;
    }

    // Invalidate list cache
    cacheManager.invalidate(`banners:all:${user.id}`);

    return data ? dbToBanner(data) : null;
  },

  // Update banner
  async update(id: string, updates: Partial<Omit<Banner, 'id' | 'createdAt'>>): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.template !== undefined) dbUpdates.template = updates.template;
    if (updates.elements !== undefined) dbUpdates.elements = updates.elements;
    if (updates.canvasColor !== undefined) dbUpdates.canvas_color = updates.canvasColor;
    if (updates.thumbnailUrl !== undefined) dbUpdates.thumbnail_url = updates.thumbnailUrl;

    const { error } = await supabase
      .from('banners')
      .update(dbUpdates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error updating banner:', error);
    } else {
      // Invalidate cache for this banner and the list
      cacheManager.invalidate(`banner:${id}`);
      cacheManager.invalidate(`banners:all:${user.id}`);
    }
  },

  // Delete banner
  async delete(id: string): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting banner:', error);
    } else {
      // Invalidate cache
      cacheManager.invalidate(`banner:${id}`);
      cacheManager.invalidate(`banners:all:${user.id}`);
    }
  },

  // Duplicate banner (insert at top of list)
  async duplicate(id: string): Promise<Banner | null> {
    const supabase = await getSupabase();
    const original = await this.getById(id);
    if (!original) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Shift all existing banners' display_order by +1 to make room at position 1
    await supabase.rpc('increment_display_orders', { p_user_id: user.id });

    const { data, error } = await supabase
      .from('banners')
      .insert({
        user_id: user.id,
        name: `${original.name} (Copy)`,
        template: original.template,
        elements: JSON.parse(JSON.stringify(original.elements)),
        canvas_color: original.canvasColor,
        thumbnail_url: original.thumbnailUrl || null,
        display_order: 1,
      })
      .select()
      .single();

    if (error) {
      console.error('Error duplicating banner:', error);
      return null;
    }

    // Invalidate list cache
    cacheManager.invalidate(`banners:all:${user.id}`);

    return data ? dbToBanner(data) : null;
  },

  // Save elements (for auto-save in editor)
  async saveElements(id: string, elements: CanvasElement[]): Promise<void> {
    await this.update(id, { elements });
  },

  // Save canvas color
  async saveCanvasColor(id: string, canvasColor: string): Promise<void> {
    await this.update(id, { canvasColor });
  },

  // Save thumbnail
  async saveThumbnail(id: string, thumbnailDataURL: string): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const fileBase = `${user.id}/thumbnails/${id}-${Date.now()}`;
    const publicUrl = await uploadDataUrlToBucket(thumbnailDataURL, 'user-images', fileBase);
    await this.update(id, { thumbnailUrl: publicUrl });
  },

  // Batch save multiple properties at once (optimized for auto-save)
  async batchSave(
    id: string,
    updates: {
      elements?: CanvasElement[];
      canvasColor?: string;
      thumbnailDataURL?: string;
    }
  ): Promise<void> {
    const supabase = await getSupabase();
    // Only update if there are actual changes
    if (Object.keys(updates).length === 0) return;
    if (updates.thumbnailDataURL) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fileBase = `${user.id}/thumbnails/${id}-${Date.now()}`;
        const publicUrl = await uploadDataUrlToBucket(updates.thumbnailDataURL, 'user-images', fileBase);
        await this.update(id, {
          elements: updates.elements,
          canvasColor: updates.canvasColor,
          thumbnailUrl: publicUrl,
        });
        return;
      }
    }

    await this.update(id, {
      elements: updates.elements,
      canvasColor: updates.canvasColor,
    });
  },

  // Update banner name
  async updateName(id: string, name: string): Promise<void> {
    await this.update(id, { name });
  },

  // Update display orders for multiple banners
  async updateDisplayOrders(orders: { id: string; displayOrder: number }[]): Promise<void> {
    const supabase = await getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update each banner's display_order
    const updates = orders.map(({ id, displayOrder }) =>
      supabase
        .from('banners')
        .update({ display_order: displayOrder })
        .eq('id', id)
        .eq('user_id', user.id)
    );

    await Promise.all(updates);

    // Invalidate cache
    cacheManager.invalidate(`banners:all:${user.id}`);
  },
};
