create table if not exists customer (
  id text primary key,
  name text not null,
  phone text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create unique index if not exists idx_customer_phone on customer(phone);

create table if not exists ticket_counter (
  service_date text primary key,
  next_ticket_number integer not null check (next_ticket_number >= 1)
);

create table if not exists customer_order (
  id text primary key,
  ticket_number integer not null check (ticket_number >= 1),
  service_date text not null,
  customer_id text not null references customer(id) on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'preparing', 'ready', 'delivered', 'cancelled')
  ),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  pulse_at text,
  ready_at text,
  delivered_at text,
  cancelled_at text,
  cancel_reason text,
  refund_pending integer not null default 0 check (refund_pending in (0, 1)),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (service_date, ticket_number)
);

create table if not exists order_item (
  id text primary key,
  order_id text not null references customer_order(id) on delete cascade,
  menu_item_id text not null references menu_item(id) on delete restrict,
  menu_variant_id text references menu_variant(id) on delete restrict,
  quantity integer not null check (quantity between 1 and 99),
  name_snapshot text not null,
  variant_name_snapshot text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  notes text
);

create index if not exists idx_customer_order_customer on customer_order(customer_id, created_at);
create index if not exists idx_customer_order_status on customer_order(status, created_at);
create index if not exists idx_order_item_order on order_item(order_id);
