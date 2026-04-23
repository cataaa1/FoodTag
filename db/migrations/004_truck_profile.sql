create table if not exists truck_profile (
  id text primary key,
  truck_config_id text not null unique references truck_config(id) on delete cascade,
  address text not null default 'Av. Corrientes 1500',
  hero_image_url text,
  public_tagline text not null default 'Food Truck · Av. Corrientes 1500',
  instagram_handle text,
  updated_at text not null default (datetime('now'))
);
