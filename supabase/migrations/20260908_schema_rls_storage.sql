-- 20260908: Esquema completo, Row Level Security y Storage para CFC-Servidores.
-- Seguro de ejecutar repetidamente (idempotente). Diseñado para Supabase en la nube.
--
-- Tablas: organizations, profiles, church_members, ministry_teams,
--         service_schedules, service_assignments, service_songs,
--         sunday_school_lessons
-- Toda operación del cliente pasa por RLS; solo un líder/admin de la iglesia
-- puede escribir. La clave de servicio (SERVER) sigue pudiendo todo.

-- ============================================================
-- 1. EXTENSIONES (para generar UUIDs)
-- ============================================================
create extension if not exists pgcrypto;

-- ============================================================
-- 2. FUNCIONES DE APOYO PARA RLS
-- ============================================================
create or replace function public.user_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_manage_org(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and organization_id = target
      and lower(role) in ('admin', 'superadmin', 'pastor', 'lider', 'coordinador')
  );
$$;

create or replace function public.is_admin_of_org(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and organization_id = target
      and lower(role) in ('admin', 'superadmin', 'pastor')
  );
$$;

-- ============================================================
-- 3. TABLAS
-- ============================================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text not null default '#4F46E5',
  secondary_color text not null default '#0F172A',
  plan text not null default 'free',
  active_modules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'servidor',
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.church_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  full_name text not null,
  role text,
  team_id uuid,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ministry_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_needed text not null default 'Servidor',
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.service_schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  service_date timestamptz not null,
  description text,
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.service_assignments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.service_schedules(id) on delete cascade,
  team_id uuid references public.ministry_teams(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  manual_name text,
  role_assigned text not null default 'Servidor',
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint service_assignments_has_assignee
    check (user_id is not null or nullif(trim(manual_name), '') is not null)
);

create table if not exists public.service_songs (
  id uuid primary key default gen_random_uuid(),
  service_schedule_id uuid not null references public.service_schedules(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  artist text,
  key_note text,
  song_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.sunday_school_lessons (
  id uuid primary key default gen_random_uuid(),
  service_schedule_id uuid not null references public.service_schedules(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_name text not null,
  topic text not null,
  material_url text,
  created_at timestamptz not null default now()
);

-- Índices de soporte para consultas por iglesia y cruces frecuentes
create index if not exists idx_profiles_org on public.profiles (organization_id);
create index if not exists idx_church_members_org on public.church_members (organization_id);
create index if not exists idx_ministry_teams_org on public.ministry_teams (organization_id);
create index if not exists idx_service_schedules_org on public.service_schedules (organization_id);
create index if not exists idx_service_assignments_orgsvc on public.service_assignments (organization_id, service_id);
create index if not exists idx_service_songs_orgsvc on public.service_songs (organization_id, service_schedule_id);
create index if not exists idx_school_lessons_orgsvc on public.sunday_school_lessons (organization_id, service_schedule_id);

-- ============================================================
-- 4. TRIGGER: perfil automático al crear usuario
-- ============================================================
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

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.church_members enable row level security;
alter table public.ministry_teams enable row level security;
alter table public.service_schedules enable row level security;
alter table public.service_assignments enable row level security;
alter table public.service_songs enable row level security;
alter table public.sunday_school_lessons enable row level security;

-- --- organizations ----------------------------------------------------------
-- Público: cualquier visitante puede ver la identidad de la iglesia (subdominio).
drop policy if exists "organizations: lectura pública" on public.organizations;
create policy "organizations: lectura pública"
  on public.organizations for select
  using (true);

drop policy if exists "organizations: solo admin edita" on public.organizations;
create policy "organizations: solo admin edita"
  on public.organizations for update
  using (public.is_admin_of_org(id))
  with check (public.is_admin_of_org(id));

-- --- profiles ---------------------------------------------------------------
-- El usuario ve su propio perfil y los de su misma iglesia.
drop policy if exists "profiles: lectura propia o de la iglesia" on public.profiles;
create policy "profiles: lectura propia o de la iglesia"
  on public.profiles for select
  using (
    id = auth.uid()
    or organization_id = public.user_organization_id()
  );

drop policy if exists "profiles: actualización solo admin" on public.profiles;
create policy "profiles: actualización solo admin"
  on public.profiles for update
  using (
    public.is_admin_of_org(organization_id)
    or (id = auth.uid() and public.user_organization_id() = organization_id)
  )
  with check (
    public.is_admin_of_org(organization_id)
    and lower(role) in ('servidor', 'lider', 'admin', 'superadmin', 'coordinador', 'pastor')
    and organization_id is not null
  );

-- --- church_members ---------------------------------------------------------
drop policy if exists "church_members: lectura de la iglesia" on public.church_members;
create policy "church_members: lectura de la iglesia"
  on public.church_members for select
  using (organization_id = public.user_organization_id());

drop policy if exists "church_members: líder o admin escribe" on public.church_members;
create policy "church_members: líder o admin escribe"
  on public.church_members for insert
  with check (public.can_manage_org(organization_id));

drop policy if exists "church_members: líder o admin actualiza" on public.church_members;
create policy "church_members: líder o admin actualiza"
  on public.church_members for update
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "church_members: líder o admin elimina" on public.church_members;
create policy "church_members: líder o admin elimina"
  on public.church_members for delete
  using (public.can_manage_org(organization_id));

-- --- ministry_teams ---------------------------------------------------------
drop policy if exists "ministry_teams: lectura de autenticados de la iglesia" on public.ministry_teams;
create policy "ministry_teams: lectura de autenticados de la iglesia"
  on public.ministry_teams for select
  using (organization_id = public.user_organization_id());

drop policy if exists "ministry_teams: líder o admin escribe" on public.ministry_teams;
create policy "ministry_teams: líder o admin escribe"
  on public.ministry_teams for insert
  with check (public.can_manage_org(organization_id));

drop policy if exists "ministry_teams: líder o admin actualiza" on public.ministry_teams;
create policy "ministry_teams: líder o admin actualiza"
  on public.ministry_teams for update
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "ministry_teams: líder o admin elimina" on public.ministry_teams;
create policy "ministry_teams: líder o admin elimina"
  on public.ministry_teams for delete
  using (public.can_manage_org(organization_id));

-- --- service_schedules ------------------------------------------------------
-- Público: el cronograma del Inicio es visible sin iniciar sesión.
drop policy if exists "service_schedules: lectura pública" on public.service_schedules;
create policy "service_schedules: lectura pública"
  on public.service_schedules for select
  using (true);

drop policy if exists "service_schedules: líder o admin crea cultos" on public.service_schedules;
create policy "service_schedules: líder o admin crea cultos"
  on public.service_schedules for insert
  with check (public.can_manage_org(organization_id));

drop policy if exists "service_schedules: líder o admin actualiza" on public.service_schedules;
create policy "service_schedules: líder o admin actualiza"
  on public.service_schedules for update
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "service_schedules: líder o admin elimina" on public.service_schedules;
create policy "service_schedules: líder o admin elimina"
  on public.service_schedules for delete
  using (public.can_manage_org(organization_id));

-- --- service_assignments ----------------------------------------------------
drop policy if exists "service_assignments: lectura de la iglesia" on public.service_assignments;
create policy "service_assignments: lectura de la iglesia"
  on public.service_assignments for select
  using (organization_id = public.user_organization_id());

-- Autoinscripción: un miembro puede anotarse a sí mismo; líder/admin puede anotar a cualquiera.
drop policy if exists "service_assignments: inscripción propia o por líder" on public.service_assignments;
create policy "service_assignments: inscripción propia o por líder"
  on public.service_assignments for insert
  with check (
    organization_id = public.user_organization_id()
    and (user_id = auth.uid() or public.can_manage_org(organization_id))
  );

drop policy if exists "service_assignments: líder o admin actualiza" on public.service_assignments;
create policy "service_assignments: líder o admin actualiza"
  on public.service_assignments for update
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "service_assignments: líder o admin elimina" on public.service_assignments;
create policy "service_assignments: líder o admin elimina"
  on public.service_assignments for delete
  using (public.can_manage_org(organization_id));

-- --- service_songs ----------------------------------------------------------
drop policy if exists "service_songs: lectura de la iglesia" on public.service_songs;
create policy "service_songs: lectura de la iglesia"
  on public.service_songs for select
  using (organization_id = public.user_organization_id());

drop policy if exists "service_songs: líder o admin escribe" on public.service_songs;
create policy "service_songs: líder o admin escribe"
  on public.service_songs for insert
  with check (public.can_manage_org(organization_id));

drop policy if exists "service_songs: líder o admin actualiza" on public.service_songs;
create policy "service_songs: líder o admin actualiza"
  on public.service_songs for update
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "service_songs: líder o admin elimina" on public.service_songs;
create policy "service_songs: líder o admin elimina"
  on public.service_songs for delete
  using (public.can_manage_org(organization_id));

-- --- sunday_school_lessons --------------------------------------------------
drop policy if exists "sunday_school_lessons: lectura de la iglesia" on public.sunday_school_lessons;
create policy "sunday_school_lessons: lectura de la iglesia"
  on public.sunday_school_lessons for select
  using (organization_id = public.user_organization_id());

drop policy if exists "sunday_school_lessons: líder o admin escribe" on public.sunday_school_lessons;
create policy "sunday_school_lessons: líder o admin escribe"
  on public.sunday_school_lessons for insert
  with check (public.can_manage_org(organization_id));

drop policy if exists "sunday_school_lessons: líder o admin actualiza" on public.sunday_school_lessons;
create policy "sunday_school_lessons: líder o admin actualiza"
  on public.sunday_school_lessons for update
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "sunday_school_lessons: líder o admin elimina" on public.sunday_school_lessons;
create policy "sunday_school_lessons: líder o admin elimina"
  on public.sunday_school_lessons for delete
  using (public.can_manage_org(organization_id));

-- ============================================================
-- 6. STORAGE: buckets y políticas
-- ============================================================
insert into storage.buckets (id, name, public)
values ('organizations', 'organizations', true),
       ('materials', 'materials', true)
on conflict (id) do nothing;

-- Lectura pública de logos y materiales (URLs accesibles sin token).
drop policy if exists "storage: lectura pública de corporativos y materiales" on storage.objects;
create policy "storage: lectura pública de corporativos y materiales"
  on storage.objects for select
  using (bucket_id in ('organizations', 'materials'));

-- Subir logo: requiere admin de la iglesia cuyo slug abre la ruta.
drop policy if exists "storage: solo admin sube logos" on storage.objects;
create policy "storage: solo admin sube logos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'organizations'
    and public.is_admin_of_org(
      (select id from public.organizations where slug = split_part(name, '/', 1))
    )
  );

drop policy if exists "storage: solo admin actualiza logos" on storage.objects;
create policy "storage: solo admin actualiza logos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'organizations'
    and public.is_admin_of_org(
      (select id from public.organizations where slug = split_part(name, '/', 1))
    )
  )
  with check (
    bucket_id = 'organizations'
    and public.is_admin_of_org(
      (select id from public.organizations where slug = split_part(name, '/', 1))
    )
  );

drop policy if exists "storage: solo admin elimina logos" on storage.objects;
create policy "storage: solo admin elimina logos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'organizations'
    and public.is_admin_of_org(
      (select id from public.organizations where slug = split_part(name, '/', 1))
    )
  );

-- Materiales de Escuela Dominical: la ruta empieza con el id de la organización.
drop policy if exists "storage: líder o admin sube materiales" on storage.objects;
create policy "storage: líder o admin sube materiales"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'materials'
    and public.can_manage_org((split_part(name, '/', 1))::uuid)
  );

drop policy if exists "storage: líder o admin actualiza materiales" on storage.objects;
create policy "storage: líder o admin actualiza materiales"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'materials'
    and public.can_manage_org((split_part(name, '/', 1))::uuid)
  )
  with check (
    bucket_id = 'materials'
    and public.can_manage_org((split_part(name, '/', 1))::uuid)
  );

drop policy if exists "storage: líder o admin elimina materiales" on storage.objects;
create policy "storage: líder o admin elimina materiales"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'materials'
    and public.can_manage_org((split_part(name, '/', 1))::uuid)
  );