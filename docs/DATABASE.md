# Database Schema

## Tables

### `profiles`
User metadata and subscription information.

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text,
  full_name text,
  avatar_url text,
  role text DEFAULT 'user', -- 'admin' | 'user'
  subscription_tier text DEFAULT 'free', -- 'free' | 'premium'
  subscription_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### `banners`
User banner data with JSONB elements.

```sql
CREATE TABLE banners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  template jsonb, -- Legacy field, prefer template_id
  elements jsonb DEFAULT '[]'::jsonb,
  canvas_color text DEFAULT '#FFFFFF',
  thumbnail_data_url text, -- Deprecated (Base64)
  thumbnail_url text, -- Supabase Storage URL
  fullres_url text, -- Supabase Storage URL for downloadable PNG
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

#### `elements` JSONB Structure
```json
[
  {
    "id": "text-123",
    "type": "text",
    "x": 100,
    "y": 50,
    "text": "Hello",
    "fontSize": 48,
    "fontFamily": "Arial",
    "fill": "#000000",
    "fillEnabled": true,
    "stroke": "#FFFFFF",
    "strokeWidth": 2,
    "strokeEnabled": false,
    "shadowEnabled": false,
    "shadowColor": "#000000",
    "shadowBlur": 4,
    "shadowOffsetX": 2,
    "shadowOffsetY": 2,
    "shadowOpacity": 0.5,
    "rotation": 0,
    "opacity": 1,
    "visible": true
  },
  {
    "id": "shape-456",
    "type": "shape",
    "shapeType": "rectangle",
    "x": 200,
    "y": 100,
    "width": 300,
    "height": 200,
    "fill": "#FF0000",
    "fillEnabled": true,
    "stroke": "#000000",
    "strokeWidth": 2,
    "strokeEnabled": false,
    "shadowEnabled": true,
    "shadowColor": "#000000",
    "shadowBlur": 10,
    "shadowOffsetX": 5,
    "shadowOffsetY": 5,
    "shadowOpacity": 0.5
  }
]
```

### `templates`
Public and premium template definitions.

```sql
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  elements jsonb DEFAULT '[]'::jsonb,
  canvas_color text DEFAULT '#FFFFFF',
  thumbnail_url text,
  plan_type text DEFAULT 'free', -- 'free' | 'premium'
  display_order integer, -- NULL values sorted last
  width integer DEFAULT 1920,
  height integer DEFAULT 1080,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### `default_images`
Premium image library and official work asset registry (curated by admins).

```sql
CREATE TABLE default_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  storage_path text UNIQUE NOT NULL,
  width integer,
  height integer,
  file_size integer,
  source_context text NOT NULL DEFAULT 'library',
  work_series_slug text,
  work_number integer,
  variant_number integer,
  asset_role text NOT NULL DEFAULT 'general',
  tags text[],
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
```

### `user_images`
Private user-uploaded images.

```sql
CREATE TABLE user_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  storage_path text UNIQUE NOT NULL,
  width integer,
  height integer,
  file_size integer,
  asset_scope text NOT NULL DEFAULT 'user',
  source_context text NOT NULL DEFAULT 'editor',
  work_series_slug text,
  work_number integer,
  variant_number integer,
  asset_role text NOT NULL DEFAULT 'general',
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamp with time zone DEFAULT now()
);
```

### `production_projects`
Variant-level production packages for Content Factory.

```sql
CREATE TABLE production_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_type text NOT NULL DEFAULT 'variant_pack',
  work_series_slug text NOT NULL,
  work_number integer NOT NULL,
  work_display_code text NOT NULL,
  variant_number integer NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  title text,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (project_type, work_series_slug, work_number, variant_number)
);
```

### `production_project_assets`
Official premium assets attached to a production project.

```sql
CREATE TABLE production_project_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
  default_image_id uuid NOT NULL REFERENCES default_images(id) ON DELETE RESTRICT,
  role text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### `production_project_banners`
Editable banners generated for a production project.

```sql
CREATE TABLE production_project_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
  banner_id uuid NOT NULL REFERENCES banners(id) ON DELETE CASCADE,
  role text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### `production_outputs`
Built delivery files derived from project banners.

```sql
CREATE TABLE production_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES production_projects(id) ON DELETE CASCADE,
  source_banner_id uuid REFERENCES banners(id) ON DELETE SET NULL,
  role text NOT NULL,
  storage_provider text NOT NULL DEFAULT 'supabase',
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  status text NOT NULL DEFAULT 'preparing',
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

### `production_delivery_packages`
Sellable/downloadable package metadata for a project.

```sql
CREATE TABLE production_delivery_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES production_projects(id) ON DELETE CASCADE,
  cover_output_id uuid REFERENCES production_outputs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  price_usd numeric(10, 2),
  is_subscription_included boolean NOT NULL DEFAULT true,
  gallery_offer_ref text,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

## RLS Policies

### `profiles`
- **Read**: Users can view their own profile
- **Insert**: Trigger-based on `auth.users` insert
- **Update**: Users can update their own profile

### `banners`
- **Read**: Users can view their own banners
- **Insert**: Authenticated users can create banners
- **Update**: Users can update their own banners
- **Delete**: Users can delete their own banners

### `templates`
- **Read**: Public read access (all users including guests)
- **Insert**: Admin only
- **Update**: Admin only
- **Delete**: Admin only

### `default_images`
- **Read**: Public read access
- **Insert**: Admin only
- **Delete**: Admin only
- **Admin usage**: Content Factory uploads official premium assets here directly

### `user_images`
- **Read**: Users can view their own images
- **Insert**: Authenticated users can upload images
- **Delete**: Users can delete their own images
- **Primary usage**: personal library for editor uploads

### `production_projects` and related tables
- **Read**: Admin only
- **Insert**: Admin only
- **Update**: Admin only
- **Delete**: Admin only
- **Primary usage**: Content Factory project grouping, editable banner linkage, build outputs, and delivery package state

## Storage Buckets

### `default-images`
- **Access**: Public read
- **Upload**: Admin only
- **Path**: `default-images/{filename}`

### `user-images`
- **Access**: Public read with RLS
- **Upload**: Authenticated users
- **Path**: `user-images/{user_id}/{filename}`

### Banner preview assets (`user-images`)
- **Access**: Public read with RLS
- **Upload**: Authenticated users
- **Thumbnail path**: `user-images/{user_id}/thumbnails/{banner_id}.jpg`
- **Download path**: `user-images/{user_id}/downloads/{banner_id}.png`
- **Behavior**: Fixed paths with overwrite (`upsert`) so each banner keeps only the latest thumbnail and latest download asset

## Indexes

```sql
-- Banners
CREATE INDEX banners_user_id_idx ON banners(user_id);
CREATE INDEX banners_updated_at_idx ON banners(updated_at DESC);

-- Templates
CREATE INDEX templates_plan_type_idx ON templates(plan_type);
CREATE INDEX templates_display_order_idx ON templates(display_order ASC NULLS LAST);

-- User Images
CREATE INDEX user_images_user_id_idx ON user_images(user_id);
CREATE INDEX user_images_scope_idx ON user_images(user_id, asset_scope, created_at DESC);
CREATE INDEX user_images_work_lookup_idx ON user_images(asset_scope, work_series_slug, work_number, variant_number, created_at DESC);

-- Default Images
CREATE INDEX default_images_tags_idx ON default_images USING GIN(tags);
CREATE INDEX default_images_work_lookup_idx ON default_images(work_series_slug, work_number, variant_number, created_at DESC);

-- Production Projects
CREATE INDEX production_projects_variant_lookup_idx ON production_projects(work_series_slug, work_number, variant_number);
CREATE INDEX production_projects_work_group_idx ON production_projects(work_series_slug, work_number, updated_at DESC);
CREATE INDEX production_project_assets_project_idx ON production_project_assets(project_id, sort_order ASC, created_at ASC);
CREATE INDEX production_project_banners_project_idx ON production_project_banners(project_id, role ASC, sort_order ASC);
CREATE INDEX production_outputs_project_idx ON production_outputs(project_id, role ASC, created_at DESC);
```

## Triggers

### Update `updated_at` timestamp
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Auto-create profile on user signup
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## Migration Notes

### Base64 to Storage URL (2025-12-16)
- Old field: `thumbnail_data_url` (Base64 string)
- New field: `thumbnail_url` (Storage public URL)
- Migration script: `src/scripts/migrate-thumbnail-data-url.js`

### Banner asset overwrite mode (2026-06-16)
- Added `fullres_url` to `banners`
- Banner thumbnails and downloadable assets now overwrite fixed Storage paths
- Cleanup script: `scripts/cleanup-banner-assets.js`

### Element Structure Evolution
- **v1**: Separate `textElements`, `shapeElements`, `imageElements` arrays
- **v2**: Unified `elements` JSONB array with `type` discriminator
- **v3**: Added shadow properties to `BaseElement`
