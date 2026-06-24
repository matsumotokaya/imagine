-- Link Content Factory production projects to the canonical Gallery work model.
-- A project remains the production package for one series/work/variant, but the
-- relationship should be explicit instead of inferred only from work_number.

alter table public.production_projects
  add column if not exists work_id uuid,
  add column if not exists variant_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_projects_work_id_fkey'
  ) then
    alter table public.production_projects
      add constraint production_projects_work_id_fkey
      foreign key (work_id)
      references public.works(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'production_projects_variant_id_fkey'
  ) then
    alter table public.production_projects
      add constraint production_projects_variant_id_fkey
      foreign key (variant_id)
      references public.work_variants(id)
      on delete set null;
  end if;
end $$;

create index if not exists production_projects_work_id_idx
  on public.production_projects (work_id);

create unique index if not exists production_projects_variant_id_unique
  on public.production_projects (variant_id)
  where variant_id is not null;

update public.production_projects pp
set
  work_id = w.id,
  variant_id = v.id
from public.work_series ws,
     public.works w,
     public.work_variants v
where ws.slug = pp.work_series_slug
  and w.series_id = ws.id
  and w.sequence_number = pp.work_number
  and v.work_id = w.id
  and v.variant_number = pp.variant_number
  and (
    pp.work_id is distinct from w.id
    or pp.variant_id is distinct from v.id
  );

comment on column public.production_projects.work_id is 'Canonical Gallery work linked to this production project.';
comment on column public.production_projects.variant_id is 'Canonical Gallery work variant linked to this production project.';
