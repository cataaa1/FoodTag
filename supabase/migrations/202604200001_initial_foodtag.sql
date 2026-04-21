create extension if not exists pgcrypto;

create table if not exists public.truck_config (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  primary_color text not null default '#F97316',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  mp_access_token_encrypted text,
  tip_defaults_json jsonb not null default '[0,5,10,15]'::jsonb,
  beep_sound_id text not null default 'classic',
  paused_manual_at timestamptz,
  paused_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null unique check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  closed boolean not null default true
);

create table if not exists public.category (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.menu_item (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.category(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  photo_url text,
  available boolean not null default true,
  has_variants boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.menu_variant (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_item(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  available boolean not null default true,
  position integer not null default 0
);

create table if not exists public.role (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_system boolean not null default false,
  permissions_json jsonb not null default '[]'::jsonb
);

create table if not exists public.staff_user (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role_id uuid not null references public.role(id),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.staff_user(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  metadata_json jsonb not null default '{}'::jsonb,
  at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_category_position on public.category(position);
create index if not exists idx_menu_item_category on public.menu_item(category_id, position);
create index if not exists idx_menu_variant_menu_item on public.menu_variant(menu_item_id, position);
create index if not exists idx_staff_user_role on public.staff_user(role_id);
create index if not exists idx_audit_log_target on public.audit_log(target_type, target_id);

alter table public.truck_config enable row level security;
alter table public.opening_hours enable row level security;
alter table public.category enable row level security;
alter table public.menu_item enable row level security;
alter table public.menu_variant enable row level security;
alter table public.role enable row level security;
alter table public.staff_user enable row level security;
alter table public.audit_log enable row level security;
