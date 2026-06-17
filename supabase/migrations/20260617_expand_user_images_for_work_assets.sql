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

create index if not exists user_images_scope_idx
  on public.user_images(user_id, asset_scope, created_at desc);

create index if not exists user_images_work_lookup_idx
  on public.user_images(asset_scope, work_series_slug, work_number, variant_number, created_at desc);
