-- 20261002: Valor de gestión eclesiástica.
-- - service_schedules.tipo_evento: etiqueta el tipo de reunión (culto, retiro, etc.)
-- - asistencia: registro de quién vino a cada culto (líder/admin/coordinador/pastor)
-- - sermons: archivo histórico de predicaciones (lectura pública, escritura liderazgo)
-- - grupos / grupo_miembros: células o grupos pequeños (solo liderazgo)
-- Idempotente; seguro de ejecutar repetidamente.

-- ===== Tipos de evento en el cronograma =====
alter table public.service_schedules
  add column if not exists tipo_evento text not null default 'culto';

create index if not exists idx_service_schedules_tipo
  on public.service_schedules (organization_id, tipo_evento, service_date);

-- ===== Asistencia a cultos =====
create table if not exists public.asistencia (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid not null references public.service_schedules(id) on delete cascade,
  member_id uuid null references public.church_members(id) on delete set null,
  full_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_asistencia_service
  on public.asistencia (service_id, organization_id);
create index if not exists idx_asistencia_member
  on public.asistencia (member_id);

alter table public.asistencia enable row level security;

drop policy if exists "asistencia: lectura liderazgo" on public.asistencia;
create policy "asistencia: lectura liderazgo"
  on public.asistencia for select
  using (can_manage_org(organization_id));

drop policy if exists "asistencia: crea liderazgo" on public.asistencia;
create policy "asistencia: crea liderazgo"
  on public.asistencia for insert
  with check (can_manage_org(organization_id));

drop policy if exists "asistencia: actualiza liderazgo" on public.asistencia;
create policy "asistencia: actualiza liderazgo"
  on public.asistencia for update
  using (can_manage_org(organization_id))
  with check (can_manage_org(organization_id));

drop policy if exists "asistencia: elimina liderazgo" on public.asistencia;
create policy "asistencia: elimina liderazgo"
  on public.asistencia for delete
  using (can_manage_org(organization_id));

-- ===== Sermones (archivo de predicaciones) =====
create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid null references public.service_schedules(id) on delete set null,
  title text not null,
  speaker text null,
  bible_text text null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sermons_org
  on public.sermons (organization_id, created_at desc);

alter table public.sermons enable row level security;

-- El archivo de predicaciones es parte de la identidad de la iglesia; lectura pública.
drop policy if exists "sermones: lectura pública" on public.sermons;
create policy "sermones: lectura pública"
  on public.sermons for select
  using (true);

drop policy if exists "sermones: crea liderazgo" on public.sermons;
create policy "sermones: crea liderazgo"
  on public.sermons for insert
  with check (can_manage_org(organization_id));

drop policy if exists "sermones: actualiza liderazgo" on public.sermons;
create policy "sermones: actualiza liderazgo"
  on public.sermons for update
  using (can_manage_org(organization_id))
  with check (can_manage_org(organization_id));

drop policy if exists "sermones: elimina liderazgo" on public.sermons;
create policy "sermones: elimina liderazgo"
  on public.sermons for delete
  using (can_manage_org(organization_id));

-- ===== Grupos / células =====
create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  leader_id uuid null references public.church_members(id) on delete set null,
  meeting_weekday smallint null,
  meeting_time text null,
  address text null,
  description text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_grupos_org
  on public.grupos (organization_id);

create table if not exists public.grupo_miembros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  member_id uuid not null references public.church_members(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (grupo_id, member_id)
);

create index if not exists idx_grupo_miembros_member
  on public.grupo_miembros (member_id);

alter table public.grupos enable row level security;
alter table public.grupo_miembros enable row level security;

drop policy if exists "grupos: lectura liderazgo" on public.grupos;
create policy "grupos: lectura liderazgo"
  on public.grupos for select
  using (can_manage_org(organization_id));

drop policy if exists "grupos: crea liderazgo" on public.grupos;
create policy "grupos: crea liderazgo"
  on public.grupos for insert
  with check (can_manage_org(organization_id));

drop policy if exists "grupos: actualiza liderazgo" on public.grupos;
create policy "grupos: actualiza liderazgo"
  on public.grupos for update
  using (can_manage_org(organization_id))
  with check (can_manage_org(organization_id));

drop policy if exists "grupos: elimina liderazgo" on public.grupos;
create policy "grupos: elimina liderazgo"
  on public.grupos for delete
  using (can_manage_org(organization_id));

drop policy if exists "grupo_miembros: lectura liderazgo" on public.grupo_miembros;
create policy "grupo_miembros: lectura liderazgo"
  on public.grupo_miembros for select
  using (can_manage_org((select g.organization_id from public.grupos g where g.id = grupo_id)));

drop policy if exists "grupo_miembros: crea liderazgo" on public.grupo_miembros;
create policy "grupo_miembros: crea liderazgo"
  on public.grupo_miembros for insert
  with check (can_manage_org((select g.organization_id from public.grupos g where g.id = grupo_id)));

drop policy if exists "grupo_miembros: actualiza liderazgo" on public.grupo_miembros;
create policy "grupo_miembros: actualiza liderazgo"
  on public.grupo_miembros for update
  using (can_manage_org((select g.organization_id from public.grupos g where g.id = grupo_id)))
  with check (can_manage_org((select g.organization_id from public.grupos g where g.id = grupo_id)));

drop policy if exists "grupo_miembros: elimina liderazgo" on public.grupo_miembros;
create policy "grupo_miembros: elimina liderazgo"
  on public.grupo_miembros for delete
  using (can_manage_org((select g.organization_id from public.grupos g where g.id = grupo_id)));