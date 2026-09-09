-- 20260927_consolidacion_borrado_admins.sql
-- Solo admin / pastor / superadmin pueden borrar registros de consolidación
-- (historial) y personas del seguimiento. Antes cualquier miembro autenticado
-- podía borrar del historial (created_by = auth.uid() o user_organization_id).

drop policy if exists "consolidations_delete_auth" on public.consolidations;
create policy "consolidations_delete_auth" on public.consolidations
  for delete to authenticated
  using (public.is_admin_of_org(organization_id));

drop policy if exists "consolidation_people: líder elimina" on public.consolidation_people;
create policy "consolidation_people: líder elimina"
  on public.consolidation_people for delete to authenticated
  using (public.is_admin_of_org(organization_id));