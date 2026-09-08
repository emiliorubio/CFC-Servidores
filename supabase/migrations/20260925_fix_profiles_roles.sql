-- 20260925_fix_profiles_roles.sql
-- Permite asignar el rol "tesorero" desde Usuarios. La política anterior solo
-- aceptaba (servidor, lider, admin, superadmin, coordinador, pastor), por lo
-- que elegir Tesorero fallaba con "new row violates row-level security policy".

drop policy if exists "profiles: actualización solo admin" on public.profiles;
create policy "profiles: actualización solo admin"
  on public.profiles for update
  using (
    public.is_admin_of_org(organization_id)
    or (id = auth.uid() and public.user_organization_id() = organization_id)
  )
  with check (
    public.is_admin_of_org(organization_id)
    and lower(role) in ('servidor', 'lider', 'admin', 'superadmin', 'coordinador', 'pastor', 'tesorero')
    and organization_id is not null
  );