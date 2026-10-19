-- Test helpers, included by each test file with \ir. Everything here lives in
-- the test transaction and is rolled back.
create schema if not exists tests;

create or replace function tests.create_user(p_email text, p_role text default 'staff')
returns uuid language plpgsql security definer as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_id, p_email, jsonb_build_object('full_name', split_part(p_email, '@', 1)));
  update public.profiles set role = p_role where id = v_id;
  return v_id;
end $$;

-- Switch to an authenticated session for this user (null = back to superuser).
create or replace function tests.login_as(p_uid uuid) returns void language plpgsql as $$
begin
  if p_uid is null then
    perform set_config('request.jwt.claims', '', true);
    reset role;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
end $$;

create or replace function tests.create_project(p_name text, p_code text, p_archived boolean default false)
returns uuid language sql security definer as $$
  insert into public.projects (name, code, archived) values (p_name, p_code, p_archived) returning id
$$;

grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;
