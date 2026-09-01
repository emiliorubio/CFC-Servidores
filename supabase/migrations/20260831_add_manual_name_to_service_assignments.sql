-- Permite registrar servidores que todavía no tienen una cuenta en la app.
-- `user_id` permanece opcional para conservar las autoinscripciones.
alter table public.service_assignments
  add column if not exists manual_name text;

alter table public.service_assignments
  add constraint service_assignments_has_assignee
  check (user_id is not null or nullif(trim(manual_name), '') is not null);

create index if not exists service_assignments_organization_service_idx
  on public.service_assignments (organization_id, service_id);
