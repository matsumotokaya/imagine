alter table public.production_projects
  add column if not exists work_title text,
  add column if not exists work_summary text,
  add column if not exists released_on date,
  add column if not exists work_tags text[];

update public.production_projects pp
set
  work_title = coalesce(pp.work_title, w.title),
  work_summary = coalesce(pp.work_summary, w.summary),
  released_on = coalesce(pp.released_on, w.released_on),
  work_tags = coalesce(
    pp.work_tags,
    (
      select case
        when count(*) = 0 then null
        else array_agg(wt.label order by wt.label asc)
      end
      from public.work_tag_map wtm
      join public.work_tags wt
        on wt.id = wtm.tag_id
      where wtm.work_id = w.id
    )
  )
from public.works w
where pp.work_id = w.id
  and (
    pp.work_title is null
    or pp.work_summary is null
    or pp.released_on is null
    or pp.work_tags is null
  );

comment on column public.production_projects.work_title is 'Canonical Gallery work title to publish from this project.';
comment on column public.production_projects.work_summary is 'Canonical Gallery work summary to publish from this project.';
comment on column public.production_projects.released_on is 'Canonical Gallery work release date to publish from this project.';
comment on column public.production_projects.work_tags is 'Canonical Gallery work tags to publish from this project.';
