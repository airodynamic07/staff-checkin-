begin;
\ir helpers.sql
select plan(8);

select tests.create_user('a@x.th') as a \gset
select tests.create_user('b@x.th') as b \gset
select tests.create_user('gone@x.th') as gone \gset
select tests.create_project('Site A', 'sitea1') as pa \gset
insert into public.visits (user_id, project_id, task, check_in_at, check_out_at)
  values (:'a', :'pa', 'tiles', now() - interval '2 hours', now() - interval '1 hour');
insert into public.visits (user_id, project_id, task) values (:'gone', :'pa', 'open');
update public.projects set archived = true where id = :'pa';
update public.profiles set active = false where id = :'gone';

-- C1: staff still see the project of their own past visits after it is archived
select tests.login_as(:'a');
select is(
  (select p.name from public.visits v left join public.projects p on p.id = v.project_id limit 1),
  'Site A', 'own visit still shows its archived project'
);
select tests.login_as(:'b');
select is((select count(*)::int from public.projects), 0, 'staff without visits there do not see the archived project');

-- I1: project_by_code reports archived projects so the app can say "closed"
select tests.login_as(:'b');
select is(public.project_by_code('sitea1') ->> 'archived', 'true', 'project_by_code returns archived projects');
select is(public.project_by_code('nope00'), null, 'unknown code returns null');
select tests.login_as(null);
select ok(not has_function_privilege('anon', 'public.project_by_code(text)', 'execute'), 'anon cannot call project_by_code');

-- I3: deactivated users cannot read projects or check out
update public.projects set archived = false where id = :'pa';
select tests.login_as(:'gone');
select is((select count(*)::int from public.projects), 0, 'inactive user sees no projects');
select throws_ok(
  format($$ select public.scan_out((select id from public.visits where user_id = %L), 't', 'w', null, null, null) $$, :'gone'),
  'P0001', 'inactive_user', 'inactive user cannot check out'
);
select is(public.project_by_code('sitea1'), null, 'inactive user gets nothing from project_by_code');

select * from finish(true);
rollback;
