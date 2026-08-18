-- Freno a la fuerza bruta en el login del staff.
--
-- Va en la base y no en memoria porque en Vercel cada request puede caer en
-- una instancia distinta: un contador en memoria no serviria de nada.
--
-- Se cuenta por email y no por IP: el objetivo es proteger una cuenta puntual,
-- y detras de una red movil muchos clientes comparten IP.
create table if not exists login_attempt (
  email text primary key,
  failed_count integer not null default 0,
  first_failed_at text,
  locked_until text
);
