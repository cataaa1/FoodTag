alter table customer_order
  add column payment_status text not null default 'approved'
  check (payment_status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded'));

alter table customer_order
  add column mp_preference_id text;

alter table customer_order
  add column mp_payment_id text;

alter table customer_order
  add column paid_at text;

create unique index if not exists idx_customer_order_mp_preference
  on customer_order(mp_preference_id)
  where mp_preference_id is not null;

create unique index if not exists idx_customer_order_mp_payment
  on customer_order(mp_payment_id)
  where mp_payment_id is not null;

create index if not exists idx_customer_order_payment_status
  on customer_order(payment_status, created_at);

create table if not exists payment_webhook_event (
  id text primary key,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  payload_json text not null,
  processed_at text,
  created_at text not null default (datetime('now')),
  unique (provider, external_event_id)
);
