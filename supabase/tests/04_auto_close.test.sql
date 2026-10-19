begin;
\ir helpers.sql
select plan(6);

select tests.create_user('a@x.th') as a \gset
select tests.create_user('b@x.th') as b \gset
select tests.create_user('c@x.th') as c \gset
select tests.create_project('Site A', 'sitea1') as pa \gset
insert into public.visits (user_id, project_id, task, check_in_at) values
  (:'a', :'pa', 'open a', now() - interval '3 hours'),
  (:'b', :'pa', 'open b', now() - interval '1 hour');
insert into public.visits (user_id, project_id, task, check_in_at, check_out_at)
  values (:'c', :'pa', 'closed c', now() - interval '5 hours', now() - interval '4 hours');

select is(public.auto_close_open_visits(), 2, 'closes the two open visits');
select is((select count(*)::int from public.visits where check_out_at is null), 0, 'nothing left open');
select is((select count(*)::int from public.visits where auto_closed = 'end_of_day'), 2, 'both flagged end_of_day');
select is((select auto_closed from public.visits where user_id = :'c'), null, 'already-closed visit untouched');
select is((select schedule from cron.job where jobname = 'auto-close-visits'), '59 16 * * *', 'scheduled at 23:59 Bangkok (16:59 UTC)');

select tests.login_as(:'a');
select throws_ok($$ select public.auto_close_open_visits() $$, '42501', null, 'staff cannot run auto-close');

select * from finish(true);
rollback;
