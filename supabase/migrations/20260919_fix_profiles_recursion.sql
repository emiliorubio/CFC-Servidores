-- 20260919: Dos correcciones que afectan a roles y permisos.

-- 1) La política de lectura de profiles (introducida en 20260915) consultaba
--    profiles dentro de su propio USING, provocando "infinite recursion
--    detected in policy for relation profiles". Eso hacía que NADIE pudiera
--    leer su perfil y todo usuario caía a rol 'servidor' (los admins perdían
--    sus permisos y el menú se cortaba en Consolidación).
--    Se reemplaza por can_manage_org() (security definer, sin recursión).
drop policy if exists "profiles: lectura propia o de la iglesia" on public.profiles;
create policy "profiles: lectura propia o de la iglesia"
  on public.profiles for select
  using (
    id = auth.uid()
    or organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

-- 2) El constraint profiles_role_check (definido manualmente en Supabase) no
--    incluía 'superadmin', así que no se podía crear el perfil del superadmin.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('servidor', 'lider', 'admin', 'coordinador', 'pastor', 'tesorero', 'superadmin'));