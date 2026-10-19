-- All visit writes from the app go through these functions. Timestamps always
-- come from the server. Errors use errcode P0001 with a short code as the
-- message; the web app translates the code.

create function public.scan_in(
  p_project_code text,
  p_task text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_project public.projects;
  v_open public.visits;
  v_new public.visits;
  v_closed_id uuid;
begin
  if not exists (select 1 from profiles where id = v_uid and active) then
    raise exception using errcode = 'P0001', message = 'inactive_user';
  end if;

  select * into v_project from projects where code = p_project_code;
  if not found then
    raise exception using errcode = 'P0001', message = 'unknown_project';
  end if;
  if v_project.archived then
    raise exception using errcode = 'P0001', message = 'archived_project';
  end if;

  -- Serialize scans by the same user so a double tap cannot race.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select * into v_open from visits where user_id = v_uid and check_out_at is null;
  if found and v_open.project_id = v_project.id then
    return jsonb_build_object('status', 'already_in', 'visit', to_jsonb(v_open), 'closed_visit_id', null);
  end if;

  if coalesce(btrim(p_task), '') = '' then
    raise exception using errcode = 'P0001', message = 'empty_task';
  end if;

  if v_open.id is not null then
    update visits set check_out_at = greatest(now(), check_in_at + interval '1 second'), auto_closed = 'switched_project'
      where id = v_open.id;
    v_closed_id := v_open.id;
  end if;

  insert into visits (user_id, project_id, task, in_lat, in_lng, in_accuracy_m)
  values (v_uid, v_project.id, btrim(p_task), p_lat, p_lng, p_accuracy)
  returning * into v_new;

  return jsonb_build_object('status', 'checked_in', 'visit', to_jsonb(v_new), 'closed_visit_id', v_closed_id);
end $$;

create function public.scan_out(
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

create function public.update_visit(
  p_visit_id uuid,
  p_check_in_at timestamptz,
  p_check_out_at timestamptz,
  p_task text,
  p_work_done text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_visit public.visits;
begin
  if not public.is_manager() then
    raise exception using errcode = 'P0001', message = 'not_manager';
  end if;

  select * into v_visit from visits where id = p_visit_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'not_your_visit';
  end if;

  -- A closed visit stays closed; an open one may keep a null check-out.
  if p_check_in_at is null
     or (p_check_out_at is null and v_visit.check_out_at is not null)
     or p_check_out_at <= p_check_in_at then
    raise exception using errcode = 'P0001', message = 'bad_times';
  end if;
  if coalesce(btrim(p_task), '') = '' then
    raise exception using errcode = 'P0001', message = 'empty_task';
  end if;

  update visits set
    check_in_at = p_check_in_at,
    check_out_at = p_check_out_at,
    task = btrim(p_task),
    work_done = nullif(btrim(p_work_done), ''),
    edited_by = auth.uid(),
    edited_at = now()
  where id = p_visit_id
  returning * into v_visit;

  return to_jsonb(v_visit);
end $$;

revoke execute on function public.scan_in(text, text, double precision, double precision, double precision) from public, anon;
revoke execute on function public.scan_out(uuid, text, text, double precision, double precision, double precision) from public, anon;
revoke execute on function public.update_visit(uuid, timestamptz, timestamptz, text, text) from public, anon;
grant execute on function public.scan_in(text, text, double precision, double precision, double precision) to authenticated;
grant execute on function public.scan_out(uuid, text, text, double precision, double precision, double precision) to authenticated;
grant execute on function public.update_visit(uuid, timestamptz, timestamptz, text, text) to authenticated;
