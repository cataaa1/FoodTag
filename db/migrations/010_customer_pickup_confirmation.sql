alter table customer_order
  add column picked_up_at text;

create index if not exists idx_customer_order_picked_up_at
  on customer_order(status, picked_up_at);
