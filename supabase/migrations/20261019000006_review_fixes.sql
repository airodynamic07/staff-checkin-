-- Fixes from the final review:
-- * staff keep seeing the project of their own visits after it is archived
--   (otherwise history and the home screen lose the project);
-- * deactivated users can no longer read projects or check out;
-- * project_by_code lets the scan page tell "closed project" from "unknown code".

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active)
$$;
revoke execute on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated;

drop policy projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (
    public.is_manager()
    or (
      public.is_active_user()
      and (
        not archived
        or exists (select 1 from public.visits v where v.project_id = projects.id and v.user_id = auth.uid())
      )
    )
  );

create function public.project_by_code(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'code', code, 'name', name, 'color', color, 'archived', archived,
                            'address', address, 'lat', lat, 'lng', lng)
  from public.projects
  where code = p_code and public.is_active_user()
$$;
revoke execute on function public.project_by_code(text) from public, anon;
grant execute on function public.project_by_code(text) to authenticated;

-- scan_out: same active check as scan_in.
create or replace function public.scan_out(
  p_visit_id uuid,
  p_task text,
  p_work_done text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_visit public.visits;
begin
  if not public.is_active_user() then
    raise exception using errcode = 'P0001', message = 'inactive_user';
  end if;
  select * into v_visit from visits where id = p_visit_id for update;
  if not found or v_visit.user_id is distinct from auth.uid() then
    raise exception using errcode = 'P0001', message = 'not_your_visit';
  end if;
  if v_visit.check_out_at is not null then
    raise exception using errcode = 'P0001', message = 'visit_not_open';
  end if;
  if coalesce(btrim(p_task), '') = '' then
    raise exception using errcode = 'P0001', message = 'empty_task';
  end if;

  update visits set
    check_out_at = greatest(now(), check_in_at + interval '1 second'),
    task = btrim(p_task),
    work_done = nullif(btrim(p_work_done), ''),
    out_lat = p_lat,
    out_lng = p_lng,
    out_accuracy_m = p_accuracy
  where id = p_visit_id
  returning * into v_visit;

  return to_jsonb(v_visit);
end $$;
