-- Local development only (`npx supabase db reset` runs this). Users are created
-- through the app's invite flow or Supabase Studio, not here.
insert into public.projects (code, name, address, color) values
  ('sitea1', 'Site A', 'Sukhumvit Soi 21, Bangkok', '#2563eb'),
  ('siteb1', 'Site B', 'Rama IX Rd, Bangkok', '#e11d48')
on conflict (code) do nothing;
