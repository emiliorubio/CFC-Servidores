-- 20261101: Solicitudes para probar la plataforma (portada de miiglesia.cl).
-- Cualquier persona puede pedir probar el sistema desde la portada pública.
-- El superadmin ve las solicitudes ("aviso") en el panel de Plataforma y
-- autoriza o rechaza el acceso. Idempotente; seguro de ejecutar repetidamente.

-- Helper: solo superadmin (para RLS de trial_requests).
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'superadmin'
  );
$$;

-- Solicitudes de interés en probar la plataforma.
create table if not exists public.trial_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  church_name text not null,
  message text not null default '',
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado')),
  created_at timestamptz not null default now(),
  approved_at timestamptz null
);

create index if not exists idx_trial_requests_status
  on public.trial_requests (status, created_at desc);

alter table public.trial_requests enable row level security;

-- Cualquier persona (visitante de la portada) puede dejarnos una solicitud.
drop policy if exists "trial_requests: crea público" on public.trial_requests;
create policy "trial_requests: crea público"
  on public.trial_requests for insert
  with check (true);

-- Solo el superadmin lee y gestiona las solicitudes.
drop policy if exists "trial_requests: lee superadmin" on public.trial_requests;
create policy "trial_requests: lee superadmin"
  on public.trial_requests for select
  using (public.is_superadmin());

drop policy if exists "trial_requests: actualiza superadmin" on public.trial_requests;
create policy "trial_requests: actualiza superadmin"
  on public.trial_requests for update
  using (public.is_superadmin())
  with check (public.is_superadmin());