-- 20260909: Cultos automáticos por frecuencia semanal y áreas de servicio por defecto.
-- 1. organizations.service_pattern guarda la frecuencia semanal de cultos:
--    [{"weekday":0,"time":"11:00"}, ...]  (0=domingo, 1=lunes ... 6=sábado)
-- 2. Equalizar patrones para CFC Vida y CFC Puente Alto.
-- 3. Áreas de servicio siempre disponibles para anotarse.
-- Idempotente, seguro de repetir.

-- ============================================================
-- 1. COLUMNA service_pattern
-- ============================================================
alter table public.organizations add column if not exists service_pattern jsonb not null default '[]'::jsonb;

-- CFC Vida: domingos 11:00 y jueves 20:00
update public.organizations
set service_pattern = '[{"weekday":0,"time":"11:00"},{"weekday":4,"time":"20:00"}]'::jsonb
where slug in ('cfcvida');

-- CFC Puente Alto: miércoles 20:00 y domingos 17:00
update public.organizations
set service_pattern = '[{"weekday":3,"time":"20:00"},{"weekday":0,"time":"17:00"}]'::jsonb
where slug in ('cfcpuentealto');

-- ============================================================
-- 2. ÁREAS DE SERVICIO POR DEFECTO (siempre listas para anotarse)
-- ============================================================
insert into public.ministry_teams (name, role_needed, organization_id)
select default_areas.name, default_areas.role_needed, o.id
from public.organizations o
cross join (
  values
    ('Adoración', 'Adoración'),
    ('Multimedia', 'Multimedia'),
    ('Ujieres', 'Ujieres'),
    ('Cafetería', 'Cafetería'),
    ('Profesorado · Maestros (Escuela Dominical)', 'Profesorado / Escuela Dominical'),
    ('Consolidación', 'Consolidación')
) as default_areas(name, role_needed)
where not exists (
  select 1
  from public.ministry_teams existing
  where existing.organization_id = o.id
    and lower(existing.name) = lower(default_areas.name)
);