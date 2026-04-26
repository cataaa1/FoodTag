create table if not exists push_subscription (
  id text primary key,
  order_id text not null references "order"(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text check (platform in ('android', 'ios', 'desktop')),
  created_at text not null default (datetime('now')),
  last_used_at text,
  failed_at text
);

create index if not exists idx_push_subscription_order_id on push_subscription(order_id);

create table if not exists beeper_event (
  id text primary key,
  order_id text not null references "order"(id) on delete cascade,
  kind text not null check (kind in ('auto_ready', 'manual_pulse', 'push_sent', 'push_failed')),
  at text not null default (datetime('now')),
  metadata_json text
);

create index if not exists idx_beeper_event_order_id on beeper_event(order_id);
