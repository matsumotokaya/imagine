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
Default image library (curated by admins).

```sql
CREATE TABLE default_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  storage_path text UNIQUE NOT NULL,
  width integer,
  height integer,
  file_size integer,
  tags text[],
  created_at timestamp with time zone DEFAULT now()
);
```

### `user_images`
User-uploaded images and admin-managed official work assets.

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

### `user_images`
- **Read**: Users can view their own images
- **Insert**: Authenticated users can upload images
- **Delete**: Users can delete their own images
- **Admin usage**: `asset_scope = 'official'` records are used by Content Factory for work-linked source assets

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
