-- Canonical core schema alignment for IMAGINE.
-- This migration is intentionally idempotent so it can be applied to
-- environments that are partially migrated.

-- ---------------------------------------------------------------------------
-- banners
-- ---------------------------------------------------------------------------

alter table public.banners
  add column if not exists fullres_url text,
  add column if not exists is_public boolean not null default false,
  add column if not exists display_order integer not null default 0,
  add column if not exists template_id uuid references public.templates(id);

update public.banners
set display_order = 0
where display_order is null;

create index if not exists banners_user_id_idx
  on public.banners(user_id);

create index if not exists banners_updated_at_idx
  on public.banners(updated_at desc);

create index if not exists banners_display_order_idx
  on public.banners(user_id, display_order asc, updated_at desc);

drop policy if exists "Users can view own or public banners" on public.banners;
drop policy if exists "Users can view their own banners" on public.banners;
drop policy if exists "Anyone can view public banners, users can view own banners" on public.banners;

create policy "Anyone can view public banners, users can view own banners"
on public.banners
for select
using (
  is_public = true or auth.uid() = user_id
);

create or replace function public.increment_display_orders(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.banners
  set display_order = coalesce(display_order, 0) + 1
  where user_id = p_user_id;
end;
$$;

grant execute on function public.increment_display_orders(uuid) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- templates
-- ---------------------------------------------------------------------------

alter table public.templates
  add column if not exists display_order integer,
  add column if not exists width integer not null default 1920,
  add column if not exists height integer not null default 1080,
  add column if not exists like_count integer not null default 0,
  add column if not exists open_count integer not null default 0;

create index if not exists templates_display_order_idx
  on public.templates(display_order asc nulls last);

-- ---------------------------------------------------------------------------
-- user_images
-- ---------------------------------------------------------------------------

alter table public.user_images
  add column if not exists asset_scope text not null default 'user',
  add column if not exists source_context text not null default 'editor',
  add column if not exists work_series_slug text,
  add column if not exists work_number integer,
  add column if not exists variant_number integer,
  add column if not exists asset_role text not null default 'general',
  add column if not exists tags text[] not null default '{}',
  add column if not exists notes text;

update public.user_images
set tags = '{}'
where tags is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_images_asset_scope_check'
  ) then
    alter table public.user_images
      add constraint user_images_asset_scope_check
      check (asset_scope in ('user', 'official'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_images_source_context_check'
  ) then
    alter table public.user_images
      add constraint user_images_source_context_check
      check (source_context in ('editor', 'content_factory', 'automation', 'migration'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_images_asset_role_check'
  ) then
    alter table public.user_images
      add constraint user_images_asset_role_check
      check (asset_role in ('general', 'character_cutout', 'background', 'logo', 'reference', 'shadow', 'derived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_images_work_number_check'
  ) then
    alter table public.user_images
      add constraint user_images_work_number_check
      check (work_number is null or work_number >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_images_variant_number_check'
  ) then
    alter table public.user_images
      add constraint user_images_variant_number_check
      check (variant_number is null or variant_number >= 1);
  end if;
end $$;

create index if not exists user_images_user_id_idx
  on public.user_images(user_id);

create index if not exists user_images_scope_idx
  on public.user_images(user_id, asset_scope, created_at desc);

create index if not exists user_images_work_lookup_idx
  on public.user_images(asset_scope, work_series_slug, work_number, variant_number, created_at desc);

-- ---------------------------------------------------------------------------
-- default_images
-- ---------------------------------------------------------------------------

create index if not exists default_images_tags_idx
  on public.default_images using gin(tags);
