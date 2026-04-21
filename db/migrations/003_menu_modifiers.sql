create table if not exists menu_item_modifier (
  id text primary key,
  menu_item_id text not null references menu_item(id) on delete cascade,
  label text not null,
  default_checked integer not null default 1 check (default_checked in (0, 1)),
  position integer not null default 0,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_menu_item_modifier_item
  on menu_item_modifier(menu_item_id, position);
