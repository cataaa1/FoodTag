create table if not exists truck_config (
  id text primary key,
  name text not null,
  logo_url text,
  primary_color text not null default '#F97316',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  tip_defaults_json text not null default '[0,5,10,15]',
  beep_sound_id text not null default 'classic',
  paused_manual_at text,
  paused_reason text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists opening_hours (
  id text primary key,
  weekday integer not null unique check (weekday between 0 and 6),
  opens_at text,
  closes_at text,
  closed integer not null default 1 check (closed in (0, 1))
);

create table if not exists category (
  id text primary key,
  name text not null,
  position integer not null default 0,
  visible integer not null default 1 check (visible in (0, 1)),
  created_at text not null default (datetime('now'))
);

create table if not exists menu_item (
  id text primary key,
  category_id text not null references category(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  photo_url text,
  available integer not null default 1 check (available in (0, 1)),
  has_variants integer not null default 0 check (has_variants in (0, 1)),
  position integer not null default 0,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists menu_variant (
  id text primary key,
  menu_item_id text not null references menu_item(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  available integer not null default 1 check (available in (0, 1)),
  position integer not null default 0
);

create table if not exists role (
  id text primary key,
  name text not null unique,
  is_system integer not null default 0 check (is_system in (0, 1)),
  permissions_json text not null default '[]'
);

create table if not exists staff_user (
  id text primary key,
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  role_id text not null references role(id),
  active integer not null default 1 check (active in (0, 1)),
  created_at text not null default (datetime('now'))
);

create table if not exists audit_log (
  id text primary key,
  actor_user_id text references staff_user(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  metadata_json text not null default '{}',
  at text not null default (datetime('now'))
);

create index if not exists idx_category_position on category(position);
create index if not exists idx_menu_item_category on menu_item(category_id, position);
create index if not exists idx_menu_variant_menu_item on menu_variant(menu_item_id, position);
create index if not exists idx_staff_user_role on staff_user(role_id);
create index if not exists idx_audit_log_target on audit_log(target_type, target_id);
