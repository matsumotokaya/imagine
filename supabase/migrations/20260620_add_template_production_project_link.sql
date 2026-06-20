-- Link templates back to the production project they were promoted from.
-- This column is the idempotency key for re-publishing: promoting the same
-- project again upserts the existing template instead of creating a duplicate.
alter table public.templates
  add column if not exists production_project_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'templates_production_project_id_fkey'
  ) then
    alter table public.templates
      add constraint templates_production_project_id_fkey
      foreign key (production_project_id)
      references public.production_projects(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'templates_production_project_id_key'
  ) then
    alter table public.templates
      add constraint templates_production_project_id_key
      unique (production_project_id);
  end if;
end $$;
