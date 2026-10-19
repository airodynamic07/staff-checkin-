begin;
\ir helpers.sql
select plan(6);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'visits', 'visits table exists');

select tests.create_user('a@x.th') as uid \gset
select results_eq(
  format('select role, language from public.profiles where id = %L', :'uid'),
  $$ values ('staff'::text, 'th'::text) $$,
  'new auth user gets a staff profile in Thai'
);

select tests.create_project('Site A', 'sitea1') as pid \gset
insert into public.visits (user_id, project_id, task) values (:'uid', :'pid', 'first');
select throws_ok(
  format($$ insert into public.visits (user_id, project_id, task) values (%L, %L, 'second') $$, :'uid', :'pid'),
  '23505', null, 'only one open visit per user'
);
select throws_ok(
  format($$ insert into public.visits (user_id, project_id, task, check_in_at, check_out_at)
            values (%L, %L, 'bad', now(), now() - interval '1 minute') $$, :'uid', :'pid'),
  '23514', null, 'check-out must be after check-in'
);

select * from finish(true);
rollback;
