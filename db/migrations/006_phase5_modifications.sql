create table if not exists order_modification_request (
  id text primary key,
  order_id text not null references customer_order(id) on delete cascade,
  customer_id text not null references customer(id) on delete cascade,
  status text not null default 'pending'
    check (status in (
      'pending',
      'approved',
      'rejected',
      'extra_payment_pending',
      'extra_payment_rejected'
    )),
  request_text text not null,
  staff_response text,
  extra_amount_cents integer not null default 0 check (extra_amount_cents >= 0),
  mp_preference_id text,
  mp_payment_id text,
  mp_checkout_url text,
  paid_at text,
  resolved_by_staff_user_id text references staff_user(id),
  resolved_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index if not exists idx_order_modification_request_order
  on order_modification_request(order_id, created_at);

create index if not exists idx_order_modification_request_status
  on order_modification_request(status, created_at);

create unique index if not exists idx_order_modification_request_mp_preference
  on order_modification_request(mp_preference_id)
  where mp_preference_id is not null;

create unique index if not exists idx_order_modification_request_mp_payment
  on order_modification_request(mp_payment_id)
  where mp_payment_id is not null;
