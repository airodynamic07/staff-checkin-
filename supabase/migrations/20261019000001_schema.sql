-- Core tables: one profile per auth user, projects with a QR code, and visits
-- (one row per check-in at a project).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'staff' check (role in ('staff', 'manager')),
  language text not null default 'th' check (language in ('en', 'th')),
  active boolean not null default true
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default substr(md5(random()::text), 1, 6),
  name text not null check (btrim(name) <> ''),
  address text,
  lat double precision,
  lng double precision,
  color text not null default '#3b82f6',
  archived boolean not null default false
);

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid not null references public.projects (id),
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  task text not null,
  work_done text,
  in_lat double precision,
  in_lng double precision,
  in_accuracy_m double precision,
  out_lat double precision,
  out_lng double precision,
  out_accuracy_m double precision,
  auto_closed text check (auto_closed in ('switched_project', 'end_of_day')),
  edited_by uuid references public.profiles (id),
  edited_at timestamptz,
  constraint visits_out_after_in check (check_out_at is null or check_out_at > check_in_at)
);

create unique index visits_one_open_per_user on public.visits (user_id) where check_out_at is null;
create index visits_user_check_in on public.visits (user_id, check_in_at);
create index visits_project_check_in on public.visits (project_id, check_in_at);

-- Create a profile whenever Supabase Auth creates a user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
