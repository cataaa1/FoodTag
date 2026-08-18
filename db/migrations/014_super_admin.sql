-- Super admin: unica cuenta habilitada para crear/editar usuarios y roles.
alter table staff_user add column is_super_admin integer not null default 0 check (is_super_admin in (0, 1));

update staff_user
set is_super_admin = 1
where lower(email) = 'admin@foodtag.ar';

-- Red de seguridad: si el admin inicial se seedeo con otro email (SEED_ADMIN_EMAIL),
-- promovemos al usuario admin mas antiguo para no quedarnos sin super admin.
update staff_user
set is_super_admin = 1
where not exists (select 1 from staff_user where is_super_admin = 1)
  and id = (
    select staff_user.id
    from staff_user
    join role on role.id = staff_user.role_id
    where role.name = 'admin'
    order by staff_user.created_at asc
    limit 1
  );
