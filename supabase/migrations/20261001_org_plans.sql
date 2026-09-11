-- 20261001_org_plans.sql
-- Planes de servicio por iglesia: basico / plata / gold.
-- - basico: Inicio (cultos), Consolidación, Finanzas y Configuración.
-- - plata: agrega Adoración, Escuela Dominical, Servidores, Directorio y Usuarios.
-- - gold: todo el anterior + Cafetería.
-- Las iglesias actuales (plan 'free' o null) conservan TODAS las funciones (gold).

alter table public.organizations
  alter column plan set default 'basico';

update public.organizations
  set plan = 'gold'
  where plan is null or plan = 'free';

alter table public.organizations
  drop constraint if exists organizations_plan_check;

alter table public.organizations
  add constraint organizations_plan_check
  check (plan in ('basico', 'plata', 'gold'));