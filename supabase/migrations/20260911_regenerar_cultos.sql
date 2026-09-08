-- 20260911: Corrige horarios de cultos generados y acceso a finanzas.
-- 1) Vuelve a actualizar can_manage_finanzas para que también acepte cuentas
--    del directorio (church_members) sin fila en profiles.
-- 2) El antiguo borrado de cultos automáticos ('Culto General') quedó
--    DESACTIVADO: re-ejecutarlo borraba los cultos de producción.
--    Se regenera desde el Inicio con "⚡ Gén. Cultos 1 mes/2 meses".

create or replace function public.can_manage_finanzas(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'superadmin'
        or (p.organization_id = target and lower(p.role) in ('admin', 'pastor', 'tesorero'))
      )
  ) or exists (
    select 1 from public.church_members cm
    where cm.organization_id = target
      and cm.role is not null and lower(cm.role) in ('admin', 'pastor', 'tesorero')
      and (
        cm.user_id = auth.uid()
        or cm.email = (select email from auth.users where id = auth.uid())
      )
  );
$$;

-- delete from public.service_schedules
-- where title = 'Culto General'
--   and organization_id in (
--     select id from public.organizations where slug in ('cfcvida', 'cfcpuentealto')
--   );