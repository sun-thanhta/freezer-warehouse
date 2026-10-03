-- RLS regression for identity & roles. Run: `npm run db:test` (supabase test db → pgTAP, rolled back).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Fixtures: two provisioned users (warehouse, admin) and one auth user without a profile
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'w@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'a@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'nobody@test.local');
insert into public.app_users (id, email, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'w@test.local', 'W'),
  ('00000000-0000-0000-0000-00000000000b', 'a@test.local', 'A');
insert into public.user_roles (user_id, role_code) values
  ('00000000-0000-0000-0000-00000000000a', 'warehouse'),
  ('00000000-0000-0000-0000-00000000000b', 'admin');

-- anon reads nothing
set local role anon;
select throws_ok($$select * from public.app_users$$, '42501', null, 'anon cannot read app_users');
reset role;

-- warehouse user: own row only, cannot write, cannot self-promote
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select is((select count(*) from public.app_users)::int, 1, 'warehouse sees only own profile');
select is(public.current_user_roles(), array['warehouse'], 'current_user_roles() = warehouse');
select is((select count(*) from public.roles)::int, 8, 'provisioned user reads role catalogue');
select throws_ok($$insert into public.user_roles (user_id, role_code) values (auth.uid(), 'admin')$$, '42501', null, 'cannot self-promote');
select throws_ok($$update public.app_users set full_name = 'x'$$, '42501', null, 'cannot edit profiles directly');

-- admin sees everyone
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is((select count(*) from public.app_users where email like '%@test.local')::int, 2, 'admin sees all profiles');

-- signed in but not provisioned: no roles, no catalogue
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
select is(public.is_provisioned(), false, 'auth user without profile is not provisioned');
select is((select count(*) from public.roles)::int, 0, 'unprovisioned user cannot read role catalogue');

select * from finish();
rollback;
