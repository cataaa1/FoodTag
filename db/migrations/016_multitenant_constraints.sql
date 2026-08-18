-- Paso 1b de multi-tenant: las dos constraints que la 015 dejo afuera porque
-- no se podian cambiar sin arrastrar datos.
--
-- SQLite no permite borrar una constraint: hay que reconstruir la tabla. Y
-- Turso aplica foreign keys, asi que `drop table` dispara un delete implicito
-- que cascadea a las hijas SIN tirar error. Reconstruir customer_order con
-- pedidos cargados borra todos los order_item en silencio (verificado: 3 -> 0).
--
-- ATENCION: esta migracion BORRA el historial de pedidos a proposito. Se hizo
-- asi porque los datos eran de prueba. Con pedidos reales habria que copiar
-- primero las hijas apuntando a la tabla nueva.

delete from customer_order;
delete from ticket_counter;

-- customer_order: `unique (service_date, ticket_number)` hacia que dos trucks
-- se pisaran la numeracion del dia. Las hijas ya quedaron vacias arriba, asi
-- que el drop no cascadea nada.
create table customer_order_new (
  id text primary key,
  truck_id text not null references truck_config(id) on delete cascade,
  ticket_number integer not null check (ticket_number >= 1),
  service_date text not null,
  customer_id text not null references customer(id) on delete restrict,
  status text not null default 'pending' check (
    status in ('pending', 'preparing', 'ready', 'delivered', 'cancelled')
  ),
  payment_status text not null default 'approved' check (
    payment_status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')
  ),
  mp_preference_id text,
  mp_payment_id text,
  paid_at text,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  pulse_at text,
  ready_at text,
  delivered_at text,
  picked_up_at text,
  cancelled_at text,
  cancel_reason text,
  refund_pending integer not null default 0 check (refund_pending in (0, 1)),
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  unique (truck_id, service_date, ticket_number)
);

drop table customer_order;

alter table customer_order_new rename to customer_order;

create index if not exists idx_customer_order_truck on customer_order(truck_id);
create unique index if not exists idx_customer_order_mp_preference on customer_order(mp_preference_id) where mp_preference_id is not null;
create unique index if not exists idx_customer_order_mp_payment on customer_order(mp_payment_id) where mp_payment_id is not null;

-- role: `name unique` era global, asi que un segundo truck no podia tener su
-- propio rol "cajero". Para poder dropear role hay que sacarle de encima a
-- staff_user, y para dropear staff_user hay que sacarle de encima a audit_log.
-- Se reconstruyen las tres en cadena, sin perder filas.
create table role_new (
  id text primary key,
  truck_id text not null references truck_config(id) on delete cascade,
  name text not null,
  is_system integer not null default 0 check (is_system in (0, 1)),
  permissions_json text not null default '[]',
  unique (truck_id, name)
);

insert into role_new (id, truck_id, name, is_system, permissions_json)
select id, truck_id, name, is_system, permissions_json from role where truck_id is not null;

create table staff_user_new (
  id text primary key,
  truck_id text not null references truck_config(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  role_id text not null references role_new(id),
  active integer not null default 1 check (active in (0, 1)),
  is_super_admin integer not null default 0 check (is_super_admin in (0, 1)),
  created_at text not null default (datetime('now'))
);

insert into staff_user_new (id, truck_id, email, full_name, password_hash, role_id, active, is_super_admin, created_at)
select id, truck_id, email, full_name, password_hash, role_id, active, is_super_admin, created_at
from staff_user where truck_id is not null;

create table audit_log_new (
  id text primary key,
  truck_id text references truck_config(id) on delete cascade,
  actor_user_id text references staff_user_new(id),
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  metadata_json text not null default '{}',
  at text not null default (datetime('now'))
);

insert into audit_log_new (id, truck_id, actor_user_id, action, target_type, target_id, reason, metadata_json, at)
select id, truck_id, actor_user_id, action, target_type, target_id, reason, metadata_json, at from audit_log;

drop table audit_log;

drop table staff_user;

drop table role;

alter table role_new rename to role;

alter table staff_user_new rename to staff_user;

alter table audit_log_new rename to audit_log;

create index if not exists idx_role_truck on role(truck_id);
create index if not exists idx_staff_user_truck on staff_user(truck_id);
create index if not exists idx_audit_log_truck on audit_log(truck_id);
