-- 20260928_service_assignments_self_delete.sql
-- Permite que un miembro se desinscriba de su propia confirmación de servicio
-- (sin depender de que el líder lo quite). El líder/admin ya borra con la
-- política "service_assignments: líder o admin elimina".

drop policy if exists "service_assignments: miembro se desinscribe" on public.service_assignments;
create policy "service_assignments: miembro se desinscribe"
  on public.service_assignments for delete to authenticated
  using (
    organization_id = public.user_organization_id() and user_id = auth.uid()
  );