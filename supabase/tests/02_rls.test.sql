begin;
\ir helpers.sql
select plan(9);

select tests.create_user('a@x.th') as a \gset
select tests.create_user('b@x.th') as b \gset
select tests.create_user('m@x.th', 'manager') as m \gset
select tests.create_project('Site A', 'sitea1') as pa \gset
select tests.create_project('Old site', 'old001', true) as pold \gset
insert into public.visits (user_id, project_id, task) values (:'a', :'pa', 'a task'), (:'b', :'pa', 'b task');

select tests.login_as(:'a');
select is((select count(*)::int from public.visits), 1, 'staff sees only own visits');
select throws_ok(
  format($$ insert into public.visits (user_id, project_id, task) values (%L, %L, 'x') $$, :'a', :'pa'),
  '42501', null, 'staff cannot insert visits directly'
);
select throws_ok($$ update public.visits set task = 'hacked' $$, '42501', null, 'staff cannot update visits directly');
select throws_ok(
  format($$ update public.profiles set role = 'manager' where id = %L $$, :'a'),
  'P0001', 'role_change_forbidden', 'staff cannot promote themselves'
);
select is((select count(*)::int from public.projects), 1, 'staff do not see archived projects');
select is((select count(*)::int from public.profiles), 1, 'staff see only their own profile');

select tests.login_as(:'m');
select is((select count(*)::int from public.visits), 2, 'manager sees all visits');
select is((select count(*)::int from public.projects), 2, 'manager sees archived projects');
update public.profiles set role = 'manager' where id = :'b';
select tests.login_as(null);
select is((select role from public.profiles where id = :'b'), 'manager', 'manager can change another user''s role');

select * from finish(true);
rollback;
