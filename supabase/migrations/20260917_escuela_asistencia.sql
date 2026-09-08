-- 20260917: Asistencia de Escuela Dominical.
-- Cada lección/tema puede llevar la lista de niños presentes.
-- Solo los líderes/admin manejan la asistencia; los miembros de la iglesia
-- pueden verla. Idempotente, seguro de repetir.

create table if not exists public.sunday_school_attendance (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.sunday_school_lessons(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  present boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists sunday_school_attendance_lesson_idx
  on public.sunday_school_attendance (organization_id, lesson_id);

alter table public.sunday_school_attendance enable row level security;

drop policy if exists "sunday_school_attendance: lectura de la iglesia" on public.sunday_school_attendance;
create policy "sunday_school_attendance: lectura de la iglesia"
  on public.sunday_school_attendance for select
  using (
    organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

drop policy if exists "sunday_school_attendance: líder o admin escribe" on public.sunday_school_attendance;
create policy "sunday_school_attendance: líder o admin escribe"
  on public.sunday_school_attendance for insert
  with check (public.can_manage_org(organization_id));

drop policy if exists "sunday_school_attendance: líder o admin actualiza" on public.sunday_school_attendance;
create policy "sunday_school_attendance: líder o admin actualiza"
  on public.sunday_school_attendance for update
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "sunday_school_attendance: líder o admin elimina" on public.sunday_school_attendance;
create policy "sunday_school_attendance: líder o admin elimina"
  on public.sunday_school_attendance for delete
  using (public.can_manage_org(organization_id));