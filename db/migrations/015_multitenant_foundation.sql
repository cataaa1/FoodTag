-- Paso 1 de multi-tenant: agrega la dimension "truck" al esquema sin cambiar
-- todavia el comportamiento de la app. Con un solo truck cargado, las queries
-- que no filtran por truck_id siguen devolviendo exactamente lo mismo.
--
-- Deliberadamente NO se tocan aca dos constraints que tambien hay que cambiar:
--   role.name unique                          -> lo bloquea staff_user.role_id
--   customer_order unique(service_date, ...)  -> 4 hijas con on delete cascade
-- Reconstruir esas tablas con las foreign keys activas (Turso las aplica)
-- borra las filas hijas en silencio. Van en su propia migracion, con el orden
-- de reconstruccion cuidado.

alter table opening_hours add column truck_id text references truck_config(id);
alter table category add column truck_id text references truck_config(id);
alter table menu_item add column truck_id text references truck_config(id);
alter table role add column truck_id text references truck_config(id);
alter table staff_user add column truck_id text references truck_config(id);
alter table customer_order add column truck_id text references truck_config(id);
alter table ticket_counter add column truck_id text references truck_config(id);
alter table audit_log add column truck_id text references truck_config(id);

-- Backfill: todo lo que existe hoy pertenece al unico truck cargado.
update opening_hours set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;
update category set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;
update menu_item set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;
update role set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;
update staff_user set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;
update customer_order set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;
update ticket_counter set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;
update audit_log set truck_id = (select id from truck_config order by created_at asc limit 1) where truck_id is null;

create index if not exists idx_category_truck on category(truck_id);
create index if not exists idx_menu_item_truck on menu_item(truck_id);
create index if not exists idx_role_truck on role(truck_id);
create index if not exists idx_staff_user_truck on staff_user(truck_id);
create index if not exists idx_customer_order_truck on customer_order(truck_id);
create index if not exists idx_audit_log_truck on audit_log(truck_id);

-- opening_hours: `weekday unique` permitia 7 filas en toda la base, o sea un
-- solo truck con horarios. Ninguna tabla la referencia, asi que reconstruirla
-- es seguro.
create table opening_hours_new (
  id text primary key,
  truck_id text not null references truck_config(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  opens_at text,
  closes_at text,
  closed integer not null default 1 check (closed in (0, 1)),
  unique (truck_id, weekday)
);

insert into opening_hours_new (id, truck_id, weekday, opens_at, closes_at, closed)
select id, truck_id, weekday, opens_at, closes_at, closed
from opening_hours
where truck_id is not null;

drop table opening_hours;

alter table opening_hours_new rename to opening_hours;

-- ticket_counter: la PK era solo service_date, asi que dos trucks compartian
-- el contador diario y se pisaban los numeros de ticket. Tampoco la referencia
-- nadie.
create table ticket_counter_new (
  truck_id text not null references truck_config(id) on delete cascade,
  service_date text not null,
  next_ticket_number integer not null check (next_ticket_number >= 1),
  primary key (truck_id, service_date)
);

insert into ticket_counter_new (truck_id, service_date, next_ticket_number)
select truck_id, service_date, next_ticket_number
from ticket_counter
where truck_id is not null;

drop table ticket_counter;

alter table ticket_counter_new rename to ticket_counter;
