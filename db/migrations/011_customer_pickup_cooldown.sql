alter table truck_config
  add column customer_pickup_cooldown_seconds integer not null default 15
  check (customer_pickup_cooldown_seconds between 0 and 300);
