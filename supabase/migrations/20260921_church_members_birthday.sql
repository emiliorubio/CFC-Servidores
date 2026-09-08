-- 20260921_church_members_birthday.sql
-- Agrega fecha de cumpleaños (opcional) a church_members para avisos en Inicio.

alter table public.church_members
  add column if not exists birth_date date;

comment on column public.church_members.birth_date is
  'Fecha de nacimiento (solo mes y día se usan para cumpleaños); también permite calcular la edad.';