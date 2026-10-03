-- YCCMS — identity & roles (design: docs/05-database/01-er-diagram-and-table-design.md §4.1).
-- app_users = provisioned people (FK to auth.users). Roles are a table so one person can hold several.
-- RLS deny-by-default (ADR-001): app users never write these tables; admin tooling / SQL functions do.

create table public.roles (
  code text primary key check (code in ('warehouse','manager','qa','sales','admin','auditor','driver','dispatcher')),
  name text not null
);

insert into public.roles (code, name) values
  ('warehouse',  'Nhân viên kho / 倉庫作業者'),
  ('manager',    'Quản lý kho / 倉庫管理者'),
  ('qa',         'QA / 品質管理'),
  ('sales',      'Sales・CS / 営業・CS'),
  ('admin',      'Quản trị / システム管理'),
  ('auditor',    'Kiểm toán (chỉ đọc) / 監査'),
  ('driver',     'Tài xế / 運転者'),
  ('dispatcher', 'Điều phối tuyến / 配車計画');

create table public.app_users (
  id          uuid primary key references auth.users (id) on delete restrict,
  email       text not null unique,
  full_name   text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.user_roles (
  user_id     uuid not null references public.app_users (id),
  role_code   text not null references public.roles (code),
  granted_by  uuid references public.app_users (id),
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_code)
);
create index user_roles_role_code_idx on public.user_roles (role_code);
create index user_roles_granted_by_idx on public.user_roles (granted_by);

-- Roles of the caller (empty when not provisioned or deactivated). SECURITY DEFINER → usable inside RLS.
create function public.current_user_roles() returns text[]
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(array_agg(ur.role_code order by ur.role_code), '{}')
  from public.user_roles ur
  join public.app_users u on u.id = ur.user_id
  where ur.user_id = auth.uid() and u.is_active
$$;

create function public.has_role(p_role text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_role = any (public.current_user_roles())
$$;

create function public.is_provisioned() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select cardinality(public.current_user_roles()) > 0
$$;

revoke execute on function public.current_user_roles(), public.has_role(text), public.is_provisioned() from public, anon;
grant execute on function public.current_user_roles(), public.has_role(text), public.is_provisioned() to authenticated;

alter table public.roles enable row level security;
alter table public.app_users enable row level security;
alter table public.user_roles enable row level security;

revoke all on public.roles, public.app_users, public.user_roles from anon;
revoke insert, update, delete, truncate on public.roles, public.app_users, public.user_roles from authenticated;
grant select on public.roles, public.app_users, public.user_roles to authenticated;

-- Provisioned users read the role catalogue; a user reads their own profile/roles; admins read everyone.
create policy roles_read on public.roles for select to authenticated using (public.is_provisioned());
create policy app_users_read on public.app_users for select to authenticated
  using (id = auth.uid() or public.has_role('admin'));
create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role('admin'));
