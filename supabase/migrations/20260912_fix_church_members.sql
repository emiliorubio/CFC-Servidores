-- 20260912: Alinea church_members con el esquema del código y amplía permisos.
-- 1) La tabla church_members real (creada en una versión antigua) no tenía las
--    columnas user_id y email; el código las usa (directorio, finanzas, contexto).
-- 2) can_manage_finanzas también reconoce cuentas del directorio.
-- 3) Los miembros autenticados pueden borrar registros de consolidación.
-- 4) Borra los "Culto General" mal horariados para regenerarlos desde el Inicio.
-- Todo idempotente, seguro de repetir.

alter table public.church_members add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.church_members add column if not exists email text;

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

drop policy if exists "consolidations_delete_auth" on public.consolidations;
create policy "consolidations_delete_auth" on public.consolidations
  for delete to authenticated
  using (
    public.can_manage_org(organization_id)
    or public.is_admin_of_org(organization_id)
    or organization_id = public.user_organization_id()
    or created_by = auth.uid()
  );

delete from public.service_schedules
where title = 'Culto General'
  and organization_id in (
    select id from public.organizations where slug in ('cfcvida', 'cfcpuentealto')
  );