-- 20260908: Módulo de Consolidación (bautizos/visitantes).
-- Añade datos de contacto de la iglesia y una tabla de registros de
-- visitantes nuevos con RLS. Idempotente, seguro de repetir.
--
-- Uso:
--   - La tabla consolidations guarda los datos de los nuevos contactos.
--   - Cualquiera que entre al enlace de una iglesia puede registrar (el equipo).
--   - Solo los miembros autenticados de esa iglesia pueden leer los registros.
--   - Los administradores pueden editar/borrar.

-- ============================================================
-- 1. DATOS DE CONTACTO DE LA IGLESIA (para el mensaje de bienvenida)
-- ============================================================
alter table public.organizations add column if not exists address text;
alter table public.organizations add column if not exists service_times text;
alter table public.organizations add column if not exists contact_phone text;

-- ============================================================
-- 2. TABLA CONSOLIDATIONS
-- ============================================================
create table if not exists public.consolidations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  event_name text not null default 'Bautizos',
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists consolidations_org_created_idx
  on public.consolidations (organization_id, created_at desc);

alter table public.consolidations enable row level security;

-- ============================================================
-- 3. POLÍTICAS RLS
-- ============================================================

-- Cualquiera con el enlace de la iglesia puede registrar un nuevo contacto.
create policy "consolidations_insert_public" on public.consolidations
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.organizations o where o.id = organization_id)
  );

-- Miembros autenticados de la iglesia ven los registros de su iglesia.
create policy "consolidations_select_org_members" on public.consolidations
  for select to authenticated
  using (
    organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

-- Solo administradores/líderes de la iglesia pueden editar.
create policy "consolidations_update_auth" on public.consolidations
  for update to authenticated
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

-- Miembros de la iglesia o quien creó el registro pueden borrarlo (corregir errores).
drop policy if exists "consolidations_delete_auth" on public.consolidations;
create policy "consolidations_delete_auth" on public.consolidations
  for delete to authenticated
  using (
    public.can_manage_org(organization_id)
    or public.is_admin_of_org(organization_id)
    or organization_id = public.user_organization_id()
    or created_by = auth.uid()
  );