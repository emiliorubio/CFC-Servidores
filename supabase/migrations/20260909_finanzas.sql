-- 20260909: Módulo de Finanzas (movimientos, saldo y cafetería).
-- Solo tesoreros, pastores y administradores de cada iglesia pueden ver y
-- escribir finanzas. El superadmin puede explorar todas las iglesias.
-- Idempotente, seguro de repetir.

-- ============================================================
-- 1. FUNCIÓN DE APOYO PARA RLS
-- ============================================================
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
  );
$$;

-- ============================================================
-- 2. TABLA DE MOVIMIENTOS
-- ============================================================
create table if not exists public.transacciones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'gasto')),
  categoria text,
  descripcion text not null,
  monto numeric not null check (monto >= 0),
  fecha date not null default current_date,
  creado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists transacciones_org_fecha_idx
  on public.transacciones (organization_id, fecha desc);

alter table public.transacciones enable row level security;

-- ============================================================
-- 3. POLÍTICAS RLS (solo roles financieros de la iglesia)
-- ============================================================
create policy "transacciones_select_finanzas" on public.transacciones
  for select to authenticated
  using (public.can_manage_finanzas(organization_id));

create policy "transacciones_insert_finanzas" on public.transacciones
  for insert to authenticated
  with check (public.can_manage_finanzas(organization_id));

create policy "transacciones_update_finanzas" on public.transacciones
  for update to authenticated
  using (public.can_manage_finanzas(organization_id))
  with check (public.can_manage_finanzas(organization_id));

create policy "transacciones_delete_finanzas" on public.transacciones
  for delete to authenticated
  using (public.can_manage_finanzas(organization_id));