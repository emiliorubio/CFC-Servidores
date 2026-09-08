-- 20260910: Limpia los "Culto General" que fueron programados por el
-- generador original con fechas/horarios en zona horaria incorrecta (se
-- guardaban como UTC). En CFC Puente Alto algunos quedaron en el día anterior
-- (por eso no coincidían con Escuela Dominical), y en ambas iglesias la hora
-- quedó corrida 3-4 horas.
--
-- OJO (2026-09): el generador ya crea los cultos con fecha/hora correctas, así
-- que este DELETE quedó DESACTIVADO para que re-ejecutar esta migración no
-- borre los cultos en producción. Se regenera desde el Inicio con
-- "⚡ Gén. Cultos 1 mes/2 meses".
--
-- delete from public.service_schedules
-- where title = 'Culto General'
--   and organization_id in (
--     select id from public.organizations where slug in ('cfcvida', 'cfcpuentealto')
--   );

-- CFC Puente Alto guardó el texto "NULL" (literal) como logo_url; sin esto la
-- app intentaría cargar una URL inválida. Ambas iglesias usan el logo por
-- defecto; si suben uno real desde Configuración se sobrescribe solo.
update public.organizations
set logo_url = null
where logo_url = 'NULL';