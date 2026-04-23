alter table truck_profile
  add column allow_order_modifications integer not null default 1
  check (allow_order_modifications in (0, 1));

alter table order_modification_request
  add column request_items_json text;
