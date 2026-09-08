-- 20260922_migrations_diagnostics.sql
-- Verifica desde la app (panel de superadmin) qué capacidades del esquema
-- están aplicadas en Supabase. Cada "check" mira un objeto real de la base
-- (columna, tabla, política o constraint), de modo que el panel puede decirle
-- al admin si falta aplicar alguna migración, sin entrar al SQL Editor.

create or replace function public.check_migrations()
returns table ("key" text, label text, applied boolean, source text)
language sql security definer
set search_path = public
as $$
  select * from (values
    ('phone', 'Teléfono en Directorio', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'church_members' and column_name = 'phone'), '20260916_church_members_phone.sql'),
    ('escuela_asistencia', 'Asistencia de Escuela Dominical', to_regclass('public.sunday_school_attendance') is not null, '20260917_escuela_asistencia.sql'),
    ('birthday', 'Cumpleaños (birth_date)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'church_members' and column_name = 'birth_date'), '20260921_church_members_birthday.sql'),
    ('public_ministry', 'Toggles público de Adoración/Escuela', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'public_adoracion'), '20260920_public_ministry_view.sql'),
    ('signup_visible', 'Registro visible por iglesia', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'signup_visible'), '20260908_org_visibility.sql'),
    ('service_pattern', 'Horarios automáticos de cultos', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'organizations' and column_name = 'service_pattern'), '20260909_cultos_automaticos.sql'),
    ('member_user_link', 'Vínculo usuario → miembro', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'church_members' and column_name = 'user_id'), '20260912_fix_church_members.sql'),
    ('superadmin_role', 'Rol superadmin permitido', exists (select 1 from pg_constraint c where c.conname = 'profiles_role_check' and c.conrelid = 'public.profiles'::regclass and pg_get_constraintdef(c.oid) ilike '%superadmin%'), '20260919_fix_profiles_recursion.sql'),
    ('org_insert_policy', 'Superadmin puede crear iglesias (RLS)', exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'organizations' and policyname ilike '%superadmin crea iglesia%'), '20260918_superadmin_create_org.sql'),
    ('finanzas', 'Módulo Finanzas', to_regclass('public.transacciones') is not null, '20260909_finanzas.sql'),
    ('consolidacion', 'Módulo Consolidación', to_regclass('public.consolidations') is not null, '20260908_consolidations.sql'),
    ('requested_role', 'Solicitud de rol (requested_role)', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'requested_role'), '20260908_user_roles.sql')
  ) t("key", label, applied, source)
$$;

revoke all on function public.check_migrations() from public;
grant execute on function public.check_migrations() to service_role;