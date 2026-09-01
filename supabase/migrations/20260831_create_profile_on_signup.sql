-- Crea el perfil de un usuario nuevo a partir de metadatos de aplicación.
-- `app_metadata` solo puede escribirse con una clave de administración; así un
-- visitante no puede elegir manualmente otra iglesia ni asignarse un rol alto.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, organization_id)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    'servidor',
    nullif(new.raw_app_meta_data ->> 'organization_id', '')::uuid
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_profile_for_new_user on auth.users;
create trigger create_profile_for_new_user
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();
