-- Let the manager "On site now" screen update live. Realtime applies RLS, so
-- staff only receive changes to their own visits.
alter publication supabase_realtime add table public.visits;
