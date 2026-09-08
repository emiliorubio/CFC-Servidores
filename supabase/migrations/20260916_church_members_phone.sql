-- 20260916: Teléfono/WhatsApp de los miembros del Directorio.
-- Permite contáctar al equipo por WhatsApp desde el Directorio.
alter table public.church_members add column if not exists phone text;