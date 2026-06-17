-- Canonical production-project schema for Content Factory.
-- One production project represents one series/work/variant package.
-- Querying the same work_number groups sibling variants under the same work.

create table if not exists public.production_projects (
  id uuid primary key default gen_random_uuid(),
  project_type text not null default 'variant_pack',
  work_series_slug text not null,
  work_number integer not null,
  work_display_code text not null,
  variant_number integer not null,
  status text not null default 'draft',
  title text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint production_projects_project_type_check
    check (project_type in ('variant_pack')),
  constraint production_projects_status_check
    check (status in ('draft', 'in_progress', 'review', 'ready', 'published', 'archived')),
  constraint production_projects_work_number_check
    check (work_number >= 1),
  constraint production_projects_variant_number_check
    check (variant_number between 1 and 99),
  unique (project_type, work_series_slug, work_number, variant_number)
);

comment on table public.production_projects is 'Variant-level production packages for Content Factory.';
comment on column public.production_projects.work_display_code is 'Public-facing work code such as 0465.';
comment on column public.production_projects.variant_number is 'Branch number inside a work, e.g. 1 for 0465-1.';

create index if not exists production_projects_variant_lookup_idx
  on public.production_projects (work_series_slug, work_number, variant_number);

create index if not exists production_projects_work_group_idx
  on public.production_projects (work_series_slug, work_number, updated_at desc);

create index if not exists production_projects_status_idx
  on public.production_projects (status, updated_at desc);

drop trigger if exists set_production_projects_updated_at on public.production_projects;

create trigger set_production_projects_updated_at
before update on public.production_projects
for each row
execute function public.update_updated_at_column();

create table if not exists public.production_project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.production_projects(id) on delete cascade,
  default_image_id uuid not null references public.default_images(id) on delete restrict,
  role text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint production_project_assets_role_check
    check (role in ('source', 'main_character', 'sub_character', 'background', 'logo', 'reference')),
  unique (project_id, default_image_id, role)
);

comment on table public.production_project_assets is 'Official premium assets attached to a production project.';
comment on column public.production_project_assets.role is 'Usage role of the asset inside the package.';

create index if not exists production_project_assets_project_idx
  on public.production_project_assets (project_id, sort_order asc, created_at asc);

create index if not exists production_project_assets_image_idx
  on public.production_project_assets (default_image_id, created_at desc);

create unique index if not exists production_project_assets_primary_unique
  on public.production_project_assets (project_id, role)
  where is_primary = true;

drop trigger if exists set_production_project_assets_updated_at on public.production_project_assets;

create trigger set_production_project_assets_updated_at
before update on public.production_project_assets
for each row
execute function public.update_updated_at_column();

create table if not exists public.production_project_banners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.production_projects(id) on delete cascade,
  banner_id uuid not null references public.banners(id) on delete cascade,
  role text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint production_project_banners_role_check
    check (role in ('portrait_master', 'landscape_master', 'instagram_feed', 'package_cover', 'imagine_template')),
  unique (project_id, banner_id),
  unique (project_id, role, sort_order)
);

comment on table public.production_project_banners is 'Editable banners generated for a production project.';
comment on column public.production_project_banners.role is 'Editing slot such as portrait master or cover.';

create index if not exists production_project_banners_project_idx
  on public.production_project_banners (project_id, role asc, sort_order asc);

create index if not exists production_project_banners_banner_idx
  on public.production_project_banners (banner_id);

create unique index if not exists production_project_banners_active_role_unique
  on public.production_project_banners (project_id, role)
  where is_active = true;

drop trigger if exists set_production_project_banners_updated_at on public.production_project_banners;

create trigger set_production_project_banners_updated_at
before update on public.production_project_banners
for each row
execute function public.update_updated_at_column();

create table if not exists public.production_outputs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.production_projects(id) on delete cascade,
  source_banner_id uuid references public.banners(id) on delete set null,
  role text not null,
  storage_provider text not null default 'supabase',
  storage_bucket text,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  status text not null default 'preparing',
  is_current boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint production_outputs_role_check
    check (role in ('mobile_qhd', 'mobile_hd', 'pc_qhd', 'pc_hd', 'instagram_feed', 'package_cover', 'zip')),
  constraint production_outputs_storage_provider_check
    check (storage_provider in ('supabase', 'r2', 'external')),
  constraint production_outputs_status_check
    check (status in ('preparing', 'ready', 'failed', 'archived')),
  constraint production_outputs_dimensions_check
    check (
      (width is null or width > 0)
      and (height is null or height > 0)
      and (file_size_bytes is null or file_size_bytes >= 0)
    ),
  constraint production_outputs_ready_requires_path_check
    check (status <> 'ready' or storage_path is not null)
);

comment on table public.production_outputs is 'Built files derived from project banners.';
comment on column public.production_outputs.role is 'Delivery artifact such as mobile_qhd or zip.';

create index if not exists production_outputs_project_idx
  on public.production_outputs (project_id, role asc, created_at desc);

create unique index if not exists production_outputs_current_role_unique
  on public.production_outputs (project_id, role)
  where is_current = true;

drop trigger if exists set_production_outputs_updated_at on public.production_outputs;

create trigger set_production_outputs_updated_at
before update on public.production_outputs
for each row
execute function public.update_updated_at_column();

create table if not exists public.production_delivery_packages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.production_projects(id) on delete cascade,
  cover_output_id uuid references public.production_outputs(id) on delete set null,
  status text not null default 'draft',
  price_usd numeric(10, 2),
  is_subscription_included boolean not null default true,
  gallery_offer_ref text,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint production_delivery_packages_status_check
    check (status in ('draft', 'preparing', 'ready', 'published', 'archived')),
  constraint production_delivery_packages_price_check
    check (price_usd is null or price_usd >= 0)
);

comment on table public.production_delivery_packages is 'Sellable/downloadable package metadata for a project.';
comment on column public.production_delivery_packages.gallery_offer_ref is 'Cross-system reference for Gallery work_offers linkage.';

create index if not exists production_delivery_packages_status_idx
  on public.production_delivery_packages (status, updated_at desc);

drop trigger if exists set_production_delivery_packages_updated_at on public.production_delivery_packages;

create trigger set_production_delivery_packages_updated_at
before update on public.production_delivery_packages
for each row
execute function public.update_updated_at_column();

alter table public.production_projects enable row level security;
alter table public.production_project_assets enable row level security;
alter table public.production_project_banners enable row level security;
alter table public.production_outputs enable row level security;
alter table public.production_delivery_packages enable row level security;

grant select, insert, update, delete on public.production_projects to authenticated;
grant select, insert, update, delete on public.production_project_assets to authenticated;
grant select, insert, update, delete on public.production_project_banners to authenticated;
grant select, insert, update, delete on public.production_outputs to authenticated;
grant select, insert, update, delete on public.production_delivery_packages to authenticated;

drop policy if exists "production_projects_select_admin" on public.production_projects;
create policy "production_projects_select_admin"
  on public.production_projects
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_projects_insert_admin" on public.production_projects;
create policy "production_projects_insert_admin"
  on public.production_projects
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_projects_update_admin" on public.production_projects;
create policy "production_projects_update_admin"
  on public.production_projects
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_projects_delete_admin" on public.production_projects;
create policy "production_projects_delete_admin"
  on public.production_projects
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_assets_select_admin" on public.production_project_assets;
create policy "production_project_assets_select_admin"
  on public.production_project_assets
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_assets_insert_admin" on public.production_project_assets;
create policy "production_project_assets_insert_admin"
  on public.production_project_assets
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_assets_update_admin" on public.production_project_assets;
create policy "production_project_assets_update_admin"
  on public.production_project_assets
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_assets_delete_admin" on public.production_project_assets;
create policy "production_project_assets_delete_admin"
  on public.production_project_assets
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_banners_select_admin" on public.production_project_banners;
create policy "production_project_banners_select_admin"
  on public.production_project_banners
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_banners_insert_admin" on public.production_project_banners;
create policy "production_project_banners_insert_admin"
  on public.production_project_banners
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_banners_update_admin" on public.production_project_banners;
create policy "production_project_banners_update_admin"
  on public.production_project_banners
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_project_banners_delete_admin" on public.production_project_banners;
create policy "production_project_banners_delete_admin"
  on public.production_project_banners
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_outputs_select_admin" on public.production_outputs;
create policy "production_outputs_select_admin"
  on public.production_outputs
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_outputs_insert_admin" on public.production_outputs;
create policy "production_outputs_insert_admin"
  on public.production_outputs
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_outputs_update_admin" on public.production_outputs;
create policy "production_outputs_update_admin"
  on public.production_outputs
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_outputs_delete_admin" on public.production_outputs;
create policy "production_outputs_delete_admin"
  on public.production_outputs
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_delivery_packages_select_admin" on public.production_delivery_packages;
create policy "production_delivery_packages_select_admin"
  on public.production_delivery_packages
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_delivery_packages_insert_admin" on public.production_delivery_packages;
create policy "production_delivery_packages_insert_admin"
  on public.production_delivery_packages
  for insert
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_delivery_packages_update_admin" on public.production_delivery_packages;
create policy "production_delivery_packages_update_admin"
  on public.production_delivery_packages
  for update
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

drop policy if exists "production_delivery_packages_delete_admin" on public.production_delivery_packages;
create policy "production_delivery_packages_delete_admin"
  on public.production_delivery_packages
  for delete
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
