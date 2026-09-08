-- 20260920: Los ministerios pueden verse en "modo lectura" por cualquier
-- miembro de la iglesia. Cada iglesia decide si muestra Adoración y/o Escuela
-- Dominical a todos (toggle en Configuración). El ministerio sigue
-- administrando (crear clases, marcar asistencia, asignar músicos, etc.).
alter table public.organizations add column if not exists public_adoracion boolean not null default true;
alter table public.organizations add column if not exists public_escuela boolean not null default true;