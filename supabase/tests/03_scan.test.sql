begin;
\ir helpers.sql
select plan(19);

select tests.create_user('a@x.th') as a \gset
select tests.create_user('b@x.th') as b \gset
select tests.create_user('m@x.th', 'manager') as m \gset
select tests.create_user('gone@x.th') as gone \gset
update public.profiles set active = false where id = :'gone';
select tests.create_project('Site A', 'sitea1') as pa \gset
select tests.create_project('Site B', 'siteb1') as pb \gset
select tests.create_project('Old site', 'old001', true) as pold \gset

-- check in
select tests.login_as(:'a');
select public.scan_in('sitea1', 'Install tiles', 13.75, 100.5, 12) as r1 \gset
select is(:'r1'::jsonb ->> 'status', 'checked_in', 'first scan checks in');
select is((:'r1'::jsonb -> 'visit' ->> 'in_lat')::float8, 13.75::float8, 'check-in GPS saved');

-- same QR again (double tap / reload): no second visit
select public.scan_in('sitea1', 'Install tiles', null, null, null) as r2 \gset
select is(:'r2'::jsonb ->> 'status', 'already_in', 'second scan at same project is already_in');
select is(:'r2'::jsonb -> 'visit' ->> 'id', :'r1'::jsonb -> 'visit' ->> 'id', 'already_in returns the open visit');
select is((select count(*)::int from public.visits), 1, 'still exactly one visit');

-- switch project
select public.scan_in('siteb1', 'Paint', null, null, null) as r3 \gset
select is(:'r3'::jsonb ->> 'closed_visit_id', :'r1'::jsonb -> 'visit' ->> 'id', 'switching reports the closed visit');
select results_eq(
  format('select check_out_at is not null, auto_closed from public.visits where id = %L', :'r1'::jsonb -> 'visit' ->> 'id'),
  $$ values (true, 'switched_project'::text) $$,
  'previous visit auto-closed as switched_project'
);
select is((select count(*)::int from public.visits where check_out_at is null), 1, 'one open visit after switch');

-- rejections
select throws_ok($$ select public.scan_in('nope00', 'x', null, null, null) $$, 'P0001', 'unknown_project', 'unknown code rejected');
select throws_ok($$ select public.scan_in('old001', 'x', null, null, null) $$, 'P0001', 'archived_project', 'archived project rejected');
select throws_ok($$ select public.scan_in('sitea1', '   ', null, null, null) $$, 'P0001', 'empty_task', 'blank task rejected');
select tests.login_as(:'gone');
select throws_ok($$ select public.scan_in('sitea1', 'x', null, null, null) $$, 'P0001', 'inactive_user', 'inactive user rejected');

-- check out
select tests.login_as(:'b');
select throws_ok(
  format($$ select public.scan_out(%L, 't', 'w', null, null, null) $$, :'r3'::jsonb -> 'visit' ->> 'id'),
  'P0001', 'not_your_visit', 'cannot check out someone else'
);
select tests.login_as(:'a');
select public.scan_out((:'r3'::jsonb -> 'visit' ->> 'id')::uuid, 'Paint walls', 'Two coats', 13.7, 100.4, 5) as r4 \gset
select results_eq(
  format('select check_out_at is not null, task, work_done, out_lat from public.visits where id = %L', :'r3'::jsonb -> 'visit' ->> 'id'),
  $$ values (true, 'Paint walls'::text, 'Two coats'::text, 13.7::float8) $$,
  'scan_out closes the visit and saves task, work done and GPS'
);
select throws_ok(
  format($$ select public.scan_out(%L, 't', 'w', null, null, null) $$, :'r3'::jsonb -> 'visit' ->> 'id'),
  'P0001', 'visit_not_open', 'cannot check out twice'
);

-- manager edits
select throws_ok(
  format($$ select public.update_visit(%L, now() - interval '2 hours', now(), 't', 'w') $$, :'r3'::jsonb -> 'visit' ->> 'id'),
  'P0001', 'not_manager', 'staff cannot edit visits'
);
select tests.login_as(:'m');
select throws_ok(
  format($$ select public.update_visit(%L, now(), now() - interval '1 hour', 't', 'w') $$, :'r3'::jsonb -> 'visit' ->> 'id'),
  'P0001', 'bad_times', 'check-out before check-in rejected'
);
select public.update_visit((:'r1'::jsonb -> 'visit' ->> 'id')::uuid, '2026-10-19 01:00Z', '2026-10-19 08:05Z', 'Install tiles', 'Done') as r5 \gset
select results_eq(
  format('select edited_by, check_out_at - check_in_at, auto_closed from public.visits where id = %L', :'r1'::jsonb -> 'visit' ->> 'id'),
  format($$ values (%L::uuid, interval '7 hours 5 minutes', 'switched_project'::text) $$, :'m'),
  'manager edit saves times, records editor and keeps the auto_closed flag'
);
select throws_ok(
  format($$ select public.update_visit(%L, '2026-10-19 09:00Z', null, 't', 'w') $$, :'r1'::jsonb -> 'visit' ->> 'id'),
  'P0001', 'bad_times', 'manager cannot reopen a visit by clearing check-out'
);

select * from finish(true);
rollback;
