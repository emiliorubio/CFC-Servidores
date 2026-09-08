-- 20260914: Funciones de apoyo de RLS ampliadas.
-- - user_organization_id(): además de profiles, reconoce a los usuarios que
--   existen solo en church_members (agregados desde el Directorio).
-- - can_manage_org() / is_admin_of_org(): mismo fallback a church_members y,
--   además, el superadmin puede gestionar cualquier iglesia.
-- Idempotente; seguro de ejecutar repetidamente.

create or replace function public.user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select organization_id from public.profiles where id = auth.uid()),
    (select organization_id from public.church_members
      where user_id = auth.uid()
        or email = (select email from auth.users where id = auth.uid())
     limit 1)
  );
$$;

create or replace function public.can_manage_org(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.organization_id = target
            and lower(p.role) in ('admin', 'superadmin', 'pastor', 'lider', 'coordinador')
          )
        )
    )
    or exists (
      select 1 from public.church_members cm
      where cm.organization_id = target
        and (
          cm.user_id = auth.uid()
          or cm.email = (select email from auth.users where id = auth.uid())
        )
        and lower(cm.role) in ('admin', 'pastor', 'lider', 'coordinador')
    );
$$;

create or replace function public.is_admin_of_org(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'superadmin'
          or (
            p.organization_id = target
            and lower(p.role) in ('admin', 'superadmin', 'pastor')
          )
        )
    )
    or exists (
      select 1 from public.church_members cm
      where cm.organization_id = target
        and (
          cm.user_id = auth.uid()
          or cm.email = (select email from auth.users where id = auth.uid())
        )
        and lower(cm.role) in ('admin', 'pastor')
    );
$$;