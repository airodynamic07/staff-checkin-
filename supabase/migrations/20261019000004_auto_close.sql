-- Close every visit still open at the end of the day (23:59 Asia/Bangkok) and
-- flag it so a manager can correct the time.

create function public.auto_close_open_visits() returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  update visits
    set check_out_at = greatest(now(), check_in_at + interval '1 second'),
        auto_closed = 'end_of_day'
    where check_out_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.auto_close_open_visits() from public, anon, authenticated;

create extension if not exists pg_cron;

-- pg_cron runs in UTC: 16:59 UTC = 23:59 in Bangkok (UTC+7, no daylight saving).
select cron.schedule('auto-close-visits', '59 16 * * *', 'select public.auto_close_open_visits()');
