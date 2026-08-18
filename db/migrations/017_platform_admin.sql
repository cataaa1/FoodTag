-- is_super_admin queda sin uso: dentro del truck manda el rol admin. La columna
-- se deja en su lugar porque quitarla obliga a reconstruir staff_user.
--
-- Superadmin de plataforma: la cuenta que esta por encima de todos los trucks.
--
-- Va en su propia tabla y no en staff_user a proposito. Un superadmin no es
-- empleado de ningun truck: no tiene truck_id, ni rol, ni permisos por truck.
-- Mezclarlo con el staff obligaba a hacer nullable una columna que es
-- obligatoria para todos los demas, y a reconstruir staff_user otra vez.
--
-- Dentro de cada truck el que manda sigue siendo el rol admin, via permisos.
create table if not exists platform_admin (
  id text primary key,
  email text not null unique,
  full_name text not null,
  password_hash text not null,
  active integer not null default 1 check (active in (0, 1)),
  created_at text not null default (datetime('now'))
);

-- El truck ahora necesita un identificador legible para la URL publica.
alter table truck_config add column slug text;

update truck_config
set slug = 'truck-' || substr(replace(id, '-', ''), 1, 8)
where slug is null;

create unique index if not exists idx_truck_config_slug on truck_config(slug);
