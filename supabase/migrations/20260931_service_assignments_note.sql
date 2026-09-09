-- 20260931_service_assignments_note.sql
-- Notas / indicaciones por asignación de servicio (ej: el líder deja
-- instrucciones al servidor para el culto).

alter table public.service_assignments
  add column if not exists note text;