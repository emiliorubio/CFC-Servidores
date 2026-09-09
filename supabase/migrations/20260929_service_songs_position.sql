-- 20260929_service_songs_position.sql
-- Permite ordenar el setlist de cada culto (el director sube/baja canciones).
-- Columna posicion (1..n por culto); backfill por fecha de creación para los existentes.

alter table public.service_songs add column if not exists posicion int not null default 0;

update public.service_songs s
set posicion = sub.rn
from (
  select id, row_number() over (
    partition by service_schedule_id, organization_id
    order by created_at, id
  ) as rn
  from public.service_songs
) sub
where s.id = sub.id;