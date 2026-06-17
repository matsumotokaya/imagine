alter table public.default_images
  add column if not exists source_context text not null default 'library',
  add column if not exists work_series_slug text,
  add column if not exists work_number integer,
  add column if not exists variant_number integer,
  add column if not exists asset_role text not null default 'general',
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'default_images_source_context_check'
  ) then
    alter table public.default_images
      add constraint default_images_source_context_check
      check (source_context in ('library', 'content_factory', 'automation', 'migration'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'default_images_asset_role_check'
  ) then
    alter table public.default_images
      add constraint default_images_asset_role_check
      check (asset_role in ('general', 'character_cutout', 'background', 'logo', 'reference', 'shadow', 'derived'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'default_images_work_number_check'
  ) then
    alter table public.default_images
      add constraint default_images_work_number_check
      check (work_number is null or work_number >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'default_images_variant_number_check'
  ) then
    alter table public.default_images
      add constraint default_images_variant_number_check
      check (variant_number is null or variant_number >= 1);
  end if;
end $$;

create index if not exists default_images_work_lookup_idx
  on public.default_images(work_series_slug, work_number, variant_number, created_at desc);
