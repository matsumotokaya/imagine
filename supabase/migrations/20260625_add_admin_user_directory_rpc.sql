create or replace function public.get_admin_user_directory()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
begin
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
  into is_admin;

  if not is_admin then
    raise exception 'admin access required';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'email', p.email,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url,
          'role', p.role,
          'subscription_tier', p.subscription_tier,
          'subscription_expires_at', p.subscription_expires_at,
          'created_at', p.created_at
        )
        order by p.created_at desc
      )
      from public.profiles p
    ),
    '[]'::jsonb
  );
end;
$$;

grant execute on function public.get_admin_user_directory() to authenticated, service_role;
