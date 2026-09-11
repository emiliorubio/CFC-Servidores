-- 20261001_org_plans.sql
-- Planes de servicio por iglesia: basico / plata / gold.
-- - basico: Inicio (cultos), Consolidación, Finanzas y Configuración.
-- - plata: agrega Adoración, Escuela Dominical, Servidores, Directorio y Usuarios.
-- - gold: todo el anterior + Cafetería.
-- Las iglesias actuales (plan 'free' o null) conservan TODAS las funciones (gold).

alter table public.organizations
  alter column plan set default 'basico';

-- El constraint legacy se elimina ANTES del update (si existiera con otra
-- regla, impediría escribir las nuevas valores).
alter table public.organizations
  drop constraint if exists organizations_plan_check;

-- Estandariza valores antiguos: 'basic' (legacy) -> 'basico';
-- 'free'/'premium' y cualquier otro valor desconocido -> 'gold'
-- (conservan todas las funciones).
update public.organizations
  set plan = case
    when plan = 'basic' then 'basico'
    else 'gold'
  end
  where plan is null or plan not in ('basico', 'plata', 'gold');

alter table public.organizations
  add constraint organizations_plan_check
  check (plan in ('basico', 'plata', 'gold'));