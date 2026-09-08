-- 20260926_fix_teams_fk.sql
-- En producción, la FK de church_members.team_id (y probablemente la de
-- service_assignments.team_id) apuntaba a una tabla distinta de
-- public.ministry_teams (restos de un schema inicial), por lo que asignar un
-- área en Usuarios fallaba con
-- "violates foreign key constraint church_members_team_id_fkey"
-- aunque el equipo existiera en ministry_teams.
--
-- Se limpian los team_id huérfanos y se recrean las FK contra ministry_teams.

update public.church_members cm
set team_id = null
where cm.team_id is not null
  and not exists (select 1 from public.ministry_teams mt where mt.id = cm.team_id);

update public.service_assignments sa
set team_id = null
where sa.team_id is not null
  and not exists (select 1 from public.ministry_teams mt where mt.id = sa.team_id);

alter table public.church_members drop constraint if exists church_members_team_id_fkey;
alter table public.church_members
  add constraint church_members_team_id_fkey
  foreign key (team_id)
  references public.ministry_teams(id)
  on delete set null;

alter table public.service_assignments drop constraint if exists service_assignments_team_id_fkey;
alter table public.service_assignments
  add constraint service_assignments_team_id_fkey
  foreign key (team_id)
  references public.ministry_teams(id)
  on delete set null;