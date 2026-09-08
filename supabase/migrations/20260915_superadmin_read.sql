-- 20260915: Lectura total para el superadmin.
-- El superadmin gestiona la plataforma completa (todas las iglesias) aunque su
-- perfil no tenga organization_id. Estas políticas le permiten leer los datos
-- de cualquier iglesia al usarlas con `can_manage_org` (que ya incluye al
-- superadmin desde 20260914). Idempotente, seguro de repetir.

-- church_members (lectura de la iglesia o del que gestiona)
drop policy if exists "church_members: lectura de la iglesia" on public.church_members;
create policy "church_members: lectura de la iglesia"
  on public.church_members for select
  using (
    organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

-- ministry_teams
drop policy if exists "ministry_teams: lectura de autenticados de la iglesia" on public.ministry_teams;
create policy "ministry_teams: lectura de autenticados de la iglesia"
  on public.ministry_teams for select
  using (
    organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

-- service_assignments
drop policy if exists "service_assignments: lectura de la iglesia" on public.service_assignments;
create policy "service_assignments: lectura de la iglesia"
  on public.service_assignments for select
  using (
    organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

-- service_songs
drop policy if exists "service_songs: lectura de la iglesia" on public.service_songs;
create policy "service_songs: lectura de la iglesia"
  on public.service_songs for select
  using (
    organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

-- sunday_school_lessons
drop policy if exists "sunday_school_lessons: lectura de la iglesia" on public.sunday_school_lessons;
create policy "sunday_school_lessons: lectura de la iglesia"
  on public.sunday_school_lessons for select
  using (
    organization_id = public.user_organization_id()
    or public.can_manage_org(organization_id)
  );

-- profiles: además de la persona y su iglesia, el superadmin ve todos los perfiles.
drop policy if exists "profiles: lectura propia o de la iglesia" on public.profiles;
create policy "profiles: lectura propia o de la iglesia"
  on public.profiles for select
  using (
    id = auth.uid()
    or organization_id = public.user_organization_id()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'superadmin'
    )
  );