-- NOVATECH public demo engagement.
-- Views are counted once per browser visitor, per demo, per UTC day.
-- Likes are unique per authenticated account and demo.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.novatech_demo_views (
  demo_slug text not null check (demo_slug in ('portail-client','playground-api')),
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$'),
  viewed_on date not null default ((now() at time zone 'UTC')::date),
  created_at timestamptz not null default now(),
  primary key (demo_slug, visitor_hash, viewed_on)
);
create index if not exists novatech_demo_views_slug_day_idx
  on private.novatech_demo_views (demo_slug, viewed_on);

create table if not exists private.novatech_demo_likes (
  demo_slug text not null check (demo_slug in ('portail-client','playground-api')),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (demo_slug, user_id)
);
create index if not exists novatech_demo_likes_slug_idx
  on private.novatech_demo_likes (demo_slug);

alter table private.novatech_demo_views enable row level security;
alter table private.novatech_demo_likes enable row level security;
revoke all on private.novatech_demo_views, private.novatech_demo_likes from public, anon, authenticated;

create or replace function public.novatech_demo_engagement(
  p_demo_slug text,
  p_visitor_hash text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_views bigint;
  v_likes bigint;
  v_liked boolean := false;
begin
  if p_demo_slug not in ('portail-client', 'playground-api') then
    raise exception 'DEMO_NOT_FOUND' using errcode = '22023';
  end if;
  if p_visitor_hash is not null then
    if p_visitor_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'VISITOR_KEY_INVALID' using errcode = '22023';
    end if;
    insert into private.novatech_demo_views (demo_slug, visitor_hash, viewed_on)
    values (p_demo_slug, p_visitor_hash, (now() at time zone 'UTC')::date)
    on conflict (demo_slug, visitor_hash, viewed_on) do nothing;
  end if;
  select count(*) into v_views from private.novatech_demo_views where demo_slug = p_demo_slug;
  select count(*) into v_likes from private.novatech_demo_likes where demo_slug = p_demo_slug;
  if auth.uid() is not null then
    select exists (
      select 1 from private.novatech_demo_likes
      where demo_slug = p_demo_slug and user_id = auth.uid()
    ) into v_liked;
  end if;
  return jsonb_build_object('demo', p_demo_slug, 'views', v_views, 'likes', v_likes,
    'liked', v_liked, 'can_like', auth.uid() is not null);
end;
$$;

create or replace function public.novatech_demo_toggle_like(
  p_demo_slug text,
  p_liked boolean
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if p_demo_slug not in ('portail-client', 'playground-api') or p_liked is null then
    raise exception 'INVALID_ARGUMENT' using errcode = '22023';
  end if;
  if p_liked then
    insert into private.novatech_demo_likes (demo_slug, user_id)
    values (p_demo_slug, auth.uid())
    on conflict (demo_slug, user_id) do nothing;
  else
    delete from private.novatech_demo_likes
    where demo_slug = p_demo_slug and user_id = auth.uid();
  end if;
  return public.novatech_demo_engagement(p_demo_slug, null);
end;
$$;

revoke all on function public.novatech_demo_engagement(text, text) from public;
grant execute on function public.novatech_demo_engagement(text, text) to anon, authenticated;
revoke all on function public.novatech_demo_toggle_like(text, boolean) from public, anon;
grant execute on function public.novatech_demo_toggle_like(text, boolean) to authenticated;
