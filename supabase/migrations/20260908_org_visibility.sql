-- 20260908: Visibilidad de iglesias para el registro + limpieza de duplicados.
--  - Solo las iglesias marcadas "signup_visible = true" aparecen en el selector
--    de Registrarse y aceptan cuentas nuevas.
--  - Elimina la duplicada vacía de "Iglesia Habitación Rancagua".

-- ============================================================
-- 1. COLUMNA DE VISIBILIDAD EN EL REGISTRO
-- ============================================================
alter table public.organizations add column if not exists signup_visible boolean not null default false;

-- Por ahora solo CFC Vida y CFC Puente Alto aceptan registros.
-- (Cuando quieras ofrecer la plataforma a otra iglesia, cambia su valor a true).
update public.organizations
set signup_visible = true
where slug in ('cfcvida', 'cfcpuentealto');

-- ============================================================
-- 2. LIMPIEZA DE DUPLICADOS
-- ============================================================
-- Elimina la "Iglesia Habitación Rancagua" duplicada (vacía, sin perfiles ni cultos).
-- La sede que se mantiene es habitacionrancagua.
delete from public.organizations
where id = 'c2a41d93-3d1b-4609-a883-9b1c71036fee'
  and not exists (select 1 from public.profiles p where p.organization_id = 'c2a41d93-3d1b-4609-a883-9b1c71036fee');

-- Nombre claro para la sede de Rancagua.
update public.organizations
set name = 'Iglesia Habitación Rancagua'
where slug = 'habitacionrancagua' and name = 'Iglesia Habitación';