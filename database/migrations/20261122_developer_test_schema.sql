-- NOVATECH Developer Playground isolated schema
-- Additive migration: preserve legacy public.userdemo* tables and all Auth users.
create schema if not exists developer_test;
comment on schema developer_test is 'NOVATECH Developer Playground application data only.';
revoke all on schema developer_test from public, anon, authenticated;
grant usage on schema developer_test to authenticated, service_role;

create table if not exists developer_test.userdemo (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  account_status text not null default 'active' check (account_status in ('active','suspended','deleted')),
  terms_accepted_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists developer_test_userdemo_email_lower_uidx on developer_test.userdemo (lower(email));

create table if not exists developer_test.userdemo_api_connections (
  id uuid primary key default gen_random_uuid(),
  userdemo_id uuid not null references developer_test.userdemo(id) on delete cascade,
  label text not null default 'Mon API',
  api_base_url text not null,
  project_id text,
  api_key_ciphertext text not null,
  api_key_iv text not null,
  api_key_tag text not null,
  encryption_version smallint not null default 1,
  is_active boolean not null default true,
  last_verified_at timestamptz,
  last_status text check (last_status is null or last_status in ('connected','invalid_key','unavailable','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint userdemo_api_connections_label_length check (char_length(label) between 1 and 80),
  constraint userdemo_api_connections_url_https check (api_base_url ~ '^https://')
);
create index if not exists developer_test_api_connections_owner_idx on developer_test.userdemo_api_connections (userdemo_id, created_at desc);

create table if not exists developer_test.userdemo_api_test_runs (
  id uuid primary key default gen_random_uuid(),
  userdemo_id uuid not null references developer_test.userdemo(id) on delete cascade,
  connection_id uuid references developer_test.userdemo_api_connections(id) on delete set null,
  endpoint_label text not null,
  http_method text not null default 'GET' check (http_method in ('GET','POST','PUT','PATCH','DELETE')),
  success boolean not null default false,
  http_status integer check (http_status between 100 and 599),
  error_code text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  response_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists developer_test_api_test_runs_owner_idx on developer_test.userdemo_api_test_runs (userdemo_id, created_at desc);
create index if not exists developer_test_api_test_runs_connection_idx on developer_test.userdemo_api_test_runs (connection_id, created_at desc);

alter table developer_test.userdemo enable row level security;
alter table developer_test.userdemo_api_connections enable row level security;
alter table developer_test.userdemo_api_test_runs enable row level security;
revoke all on developer_test.userdemo from public, anon, authenticated;
revoke all on developer_test.userdemo_api_connections from public, anon, authenticated;
revoke all on developer_test.userdemo_api_test_runs from public, anon, authenticated;
grant select, insert, update on developer_test.userdemo to authenticated;
grant select, insert, update, delete on developer_test.userdemo_api_connections to authenticated;
grant select, insert on developer_test.userdemo_api_test_runs to authenticated;
grant all on developer_test.userdemo to service_role;
grant all on developer_test.userdemo_api_connections to service_role;
grant all on developer_test.userdemo_api_test_runs to service_role;

drop policy if exists userdemo_owner_select on developer_test.userdemo;
create policy userdemo_owner_select on developer_test.userdemo for select to authenticated using ((select auth.uid()) = id);
drop policy if exists userdemo_owner_insert on developer_test.userdemo;
create policy userdemo_owner_insert on developer_test.userdemo for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists userdemo_owner_update on developer_test.userdemo;
create policy userdemo_owner_update on developer_test.userdemo for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists userdemo_connections_owner_select on developer_test.userdemo_api_connections;
create policy userdemo_connections_owner_select on developer_test.userdemo_api_connections for select to authenticated using ((select auth.uid()) = userdemo_id);
drop policy if exists userdemo_connections_owner_insert on developer_test.userdemo_api_connections;
create policy userdemo_connections_owner_insert on developer_test.userdemo_api_connections for insert to authenticated with check ((select auth.uid()) = userdemo_id);
drop policy if exists userdemo_connections_owner_update on developer_test.userdemo_api_connections;
create policy userdemo_connections_owner_update on developer_test.userdemo_api_connections for update to authenticated using ((select auth.uid()) = userdemo_id) with check ((select auth.uid()) = userdemo_id);
drop policy if exists userdemo_connections_owner_delete on developer_test.userdemo_api_connections;
create policy userdemo_connections_owner_delete on developer_test.userdemo_api_connections for delete to authenticated using ((select auth.uid()) = userdemo_id);

drop policy if exists userdemo_test_runs_owner_select on developer_test.userdemo_api_test_runs;
create policy userdemo_test_runs_owner_select on developer_test.userdemo_api_test_runs for select to authenticated using ((select auth.uid()) = userdemo_id);
drop policy if exists userdemo_test_runs_owner_insert on developer_test.userdemo_api_test_runs;
create policy userdemo_test_runs_owner_insert on developer_test.userdemo_api_test_runs for insert to authenticated with check ((select auth.uid()) = userdemo_id);
