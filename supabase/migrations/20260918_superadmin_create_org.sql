-- 20260918: El superadmin puede crear nuevas iglesias desde la plataforma.
-- Antes las organizaciones solo se insertaban por SQL de seed.
drop policy if exists "organizations: superadmin crea iglesia" on public.organizations;
create policy "organizations: superadmin crea iglesia"
  on public.organizations for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'superadmin'
    )
  );