-- Row-level security. Staff see only their own data; managers see everything.
-- Visits are never written directly: all writes go through the functions in
-- the scan_rpc and auto_close migrations.

create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager' and active
  )
$$;
grant execute on function public.is_manager() to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.visits enable row level security;

-- profiles
grant select, update (full_name, language, role, active) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_manager());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_manager())
  with check (id = auth.uid() or public.is_manager());

-- Only a manager may change role/active, and never on their own profile.
create function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and auth.uid() is not null
     and (not public.is_manager() or new.id = auth.uid()) then
    raise exception using errcode = 'P0001', message = 'role_change_forbidden';
  end if;
  return new;
end $$;

create trigger guard_profile_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- projects
grant select on public.projects to authenticated;
grant insert, update (name, address, lat, lng, color, archived) on public.projects to authenticated;

create policy projects_select on public.projects for select to authenticated
  using (not archived or public.is_manager());
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_manager());
create policy projects_update on public.projects for update to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- visits: read-only through the API
revoke all on public.visits from anon, authenticated;
grant select on public.visits to authenticated;

create policy visits_select on public.visits for select to authenticated
  using (user_id = auth.uid() or public.is_manager());
