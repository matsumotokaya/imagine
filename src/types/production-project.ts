import type { StorageProvider } from '../utils/assetUrl';

export type ProductionProjectStatus =
  | 'draft'
  | 'in_progress'
  | 'review'
  | 'ready'
  | 'published'
  | 'archived';

export type ProductionOutputRole =
  | 'mobile_qhd'
  | 'mobile_hd'
  | 'pc_qhd'
  | 'pc_hd'
  | 'instagram_feed'
  // Lightweight credited feed thumbnail (~720px long edge, WebP) derived from
  // the instagram_feed output. Consumed by the Gallery list grid served
  // `unoptimized` to bypass Vercel Image Optimization.
  | 'feed_thumb'
  | 'package_cover'
  | 'zip';

export type ProductionProjectBannerRole =
  | 'portrait_master'
  | 'landscape_master'
  | 'instagram_feed'
  | 'package_cover'
  | 'imagine_template';

export interface ProductionProject {
  id: string;
  project_type: 'variant_pack';
  work_series_slug: string;
  work_number: number;
  work_display_code: string;
  variant_number: number;
  work_id: string | null;
  variant_id: string | null;
  work_title: string | null;
  work_summary: string | null;
  released_on: string | null;
  work_tags: string[] | null;
  status: ProductionProjectStatus;
  title: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionProjectBannerLink {
  id: string;
  project_id: string;
  banner_id: string;
  role: ProductionProjectBannerRole;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductionBannerSummary {
  id: string;
  name: string;
  updated_at: string;
  thumbnail_url: string | null;
  fullres_url: string | null;
  template: {
    width?: number;
    height?: number;
  } | null;
}

export interface ProductionProjectSummary {
  project: ProductionProject;
  canonicalWork: {
    id: string;
    title: string;
    summary: string | null;
    releasedOn: string | null;
    tags: string[];
  } | null;
  sourceAsset: {
    id: string;
    name: string;
    storage_path: string;
    storage_provider?: StorageProvider;
  } | null;
  banners: Array<{
    linkId: string;
    bannerId: string;
    role: ProductionProjectBannerRole;
    sortOrder: number;
    name: string;
    thumbnailUrl: string | null;
    fullresUrl: string | null;
    width?: number;
    height?: number;
  }>;
}
