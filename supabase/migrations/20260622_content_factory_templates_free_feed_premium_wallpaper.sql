-- Content Factory template plan model rework.
--
-- Goal: the Gallery "Edit in IMAGINE" entry (the instagram_feed design) must be
-- editable by everyone, while the wallpaper-sized designs become premium-only
-- templates so paying members can freely edit them (raising subscription value)
-- without giving away the paid wallpaper downloads.
--
-- Previously every published project promoted ONLY its instagram_feed banner to
-- a single `premium` template, keyed by a UNIQUE(production_project_id). Now each
-- project can promote up to three role-specific templates, so the idempotency key
-- becomes (production_project_id, production_banner_role).

-- 1. Track which editable-draft role each promoted template came from.
alter table public.templates
  add column if not exists production_banner_role text;

-- 2. Existing promoted templates are all instagram_feed (only role promoted so far).
update public.templates
set production_banner_role = 'instagram_feed'
where production_project_id is not null
  and production_banner_role is null;

-- 3. Swap the idempotency key to (project, role). NULL/NULL for manual templates
--    is unaffected (Postgres allows multiple NULLs in a unique constraint).
alter table public.templates
  drop constraint if exists templates_production_project_id_key;

alter table public.templates
  add constraint templates_production_project_role_key
  unique (production_project_id, production_banner_role);

-- 4. Free up the Gallery-linked feed templates (the editing entry point).
update public.templates
set plan_type = 'free'
where production_project_id is not null
  and production_banner_role = 'instagram_feed'
  and plan_type = 'premium';

-- 5. Keep the Gallery imagine_starter offers consistent (Gallery does not gate on
--    this, but the data should reflect that the starter is open to everyone).
update public.work_offers
set plan_type = 'free'
where offer_type = 'imagine_starter'
  and plan_type = 'premium';

-- 6. Backfill premium wallpaper templates for already-published projects from
--    their existing editable portrait_master / landscape_master drafts, so the
--    wallpaper designs are immediately available to premium members.
insert into public.templates (
  production_project_id,
  production_banner_role,
  name,
  elements,
  canvas_color,
  thumbnail_url,
  plan_type,
  is_public,
  width,
  height
)
select
  ppb.project_id,
  ppb.role,
  b.name,
  b.elements,
  b.canvas_color,
  b.thumbnail_url,
  'premium',
  true,
  (b.template->>'width')::int,
  (b.template->>'height')::int
from public.production_project_banners ppb
join public.production_projects pp
  on pp.id = ppb.project_id and pp.status = 'published'
join public.banners b
  on b.id = ppb.banner_id
where ppb.role in ('portrait_master', 'landscape_master')
  and ppb.is_active = true
  and (b.template->>'width') is not null
  and (b.template->>'height') is not null
on conflict (production_project_id, production_banner_role) do nothing;
