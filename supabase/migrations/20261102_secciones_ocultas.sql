-- El superadmin puede ocultar del menú cualquier sección de una iglesia
-- (cada iglesia pide su propia configuración). Los valores guardan el
-- nombre del módulo/sección tal como lo identifica el navbar.
-- eslint-disable-next-line -- (no aplica: archivo SQL)
alter table public.organizations
  add column if not exists hidden_modules text[] not null default '{}'::text[];