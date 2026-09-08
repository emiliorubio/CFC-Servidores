-- 20260908: Roles de usuario y listado de perfiles.
-- - Añade email y requested_role a profiles (para ver/administrar usuarios).
-- - El perfil se crea con rol 'servidor' y guarda el rol deseado del registro.
-- - Un administrador asigna el rol real desde la página de Usuarios.

-- ============================================================
-- 1. COLUMNAS NUEVAS EN PROFILES
-- ============================================================
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists requested_role text;

-- Rellena el correo de los perfiles existentes.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

-- ============================================================
-- 2. TRIGGER: crea el perfil rellenando email y el rol deseado
--    (el rol efectivo sigue siendo 'servidor' hasta que el admin decida).
-- ============================================================
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  v_requested_role text := lower(nullif(trim(coalesce(new.raw_user_meta_data ->> 'requested_role', '')), ''));
begin
  if v_requested_role not in ('servidor', 'lider', 'coordinador', 'pastor', 'admin', 'superadmin') then
    v_requested_role := null;
  end if;

  insert into public.profiles (id, full_name, role, organization_id, email, requested_role)
  values (
    new.id,
    v_full_name,
    'servidor',
    nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid,
    nullif(new.email, ''),
    v_requested_role
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user on auth.users;
create trigger create_profile_for_new_user
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();