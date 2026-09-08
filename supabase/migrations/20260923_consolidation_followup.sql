-- 20260923_consolidation_followup.sql
-- Da seguimiento a las personas que deciden: cada persona tiene un estado
-- (nuevo → reiterado → integrado). Los registros de consolidations se agrupan
-- por persona (por teléfono, o por nombre si no hay teléfono).

create table if not exists public.consolidation_people (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  status text not null default 'nuevo' check (status in ('nuevo', 'reiterado', 'integrado')),
  created_at timestamptz not null default now()
);

create index if not exists consolidation_people_organization_idx
  on public.consolidation_people(organization_id);

-- Relación de los registros con su persona (backfill posterior de los viejos).
alter table public.consolidations
  add column if not exists person_id uuid references public.consolidation_people(id) on delete set null;

-- Backfill: agrupa los registros existentes y crea una persona por contacto
-- (teléfono, o nombre completo si no hay teléfono). Es idempotente: no
-- duplica personas si el script se corre más de una vez.
insert into public.consolidation_people (organization_id, full_name, phone, email, status)
select
  c.organization_id,
  c.full_name,
  c.phone,
  nullif(min(c.email), '') as email,
  case when count(*) >= 2 then 'reiterado' else 'nuevo' end as status
from public.consolidations c
group by c.organization_id, coalesce(c.phone, c.full_name), c.full_name, c.phone
having not exists (
  select 1
  from public.consolidation_people pp
  where pp.organization_id = c.organization_id
    and pp.full_name = c.full_name
    and coalesce(pp.phone, pp.full_name) = coalesce(c.phone, c.full_name)
);

-- Unicidad para que la app no cree personas duplicadas.
create unique index if not exists consolidation_people_org_phone_uq
  on public.consolidation_people (organization_id, phone) where phone is not null;
create unique index if not exists consolidation_people_org_name_uq
  on public.consolidation_people (organization_id, full_name) where phone is null;

-- Vincula los registros a su persona (no re-vincula los ya asignados).
update public.consolidations c
set person_id = p.id
from public.consolidation_people p
where p.organization_id = c.organization_id
  and p.full_name = c.full_name
  and coalesce(p.phone, p.full_name) = coalesce(c.phone, c.full_name)
  and c.person_id is null;

-- RLS: lectura para miembros de la iglesia; la gestión del estado (update/delete)
-- solo para líderes/admin/pastor/superadmin.
alter table public.consolidation_people enable row level security;

drop policy if exists "consolidation_people: lectura de la iglesia" on public.consolidation_people;
create policy "consolidation_people: lectura de la iglesia"
  on public.consolidation_people for select to authenticated
  using (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "consolidation_people: registro de la iglesia" on public.consolidation_people;
create policy "consolidation_people: registro de la iglesia"
  on public.consolidation_people for insert to authenticated
  with check (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "consolidation_people: líder actualiza" on public.consolidation_people;
create policy "consolidation_people: líder actualiza"
  on public.consolidation_people for update to authenticated
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "consolidation_people: líder elimina" on public.consolidation_people;
create policy "consolidation_people: líder elimina"
  on public.consolidation_people for delete to authenticated
  using (public.can_manage_org(organization_id));