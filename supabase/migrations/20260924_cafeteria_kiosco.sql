-- 20260924_cafeteria_kiosco.sql
-- Kiosco de cafetería profesional: menú por iglesia, ventas detalladas y
-- corrección de artículos. Las ventas quedan registradas como ingreso en
-- transacciones (categoría Cafetería) y enlazadas para corregirse.

update public.organizations set plan = 'free' where plan is null;

create table public.cafeteria_productos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nombre text not null,
  precio numeric(12,0) not null check (precio >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create index cafeteria_productos_org_idx on public.cafeteria_productos(organization_id);

create table public.cafeteria_ventas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metodo text not null default 'Efectivo' check (metodo in ('Efectivo', 'Tarjeta')),
  total numeric(12,0) not null default 0,
  cliente text,
  transaccion_id uuid references public.transacciones(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index cafeteria_ventas_org_idx on public.cafeteria_ventas(organization_id, created_at desc);
create index cafeteria_ventas_transaccion_idx on public.cafeteria_ventas(transaccion_id);

create table public.cafeteria_venta_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.cafeteria_ventas(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  producto_id uuid references public.cafeteria_productos(id) on delete set null,
  nombre text not null,
  precio numeric(12,0) not null,
  cantidad integer not null default 1 check (cantidad > 0),
  created_at timestamptz not null default now()
);

create index cafeteria_venta_items_venta_idx on public.cafeteria_venta_items(venta_id);

-- Menú inicial para las iglesias que ya usan cafetería (misma lista que la app).
insert into public.cafeteria_productos (organization_id, nombre, precio)
select distinct t.organization_id, p.nombre, p.precio
from public.transacciones t
cross join (values
  ('Agua', 1000), ('Café', 1000), ('Alka', 500),
  ('Completo', 2000), ('Bebida', 1000), ('Chicle', 500)
) as p(nombre, precio)
where t.categoria = 'Cafetería'
  and not exists (
    select 1 from public.cafeteria_productos cp
    where cp.organization_id = t.organization_id and cp.nombre = p.nombre
  );

-- RLS
alter table public.cafeteria_productos enable row level security;
alter table public.cafeteria_ventas enable row level security;
alter table public.cafeteria_venta_items enable row level security;

drop policy if exists "cafeteria_productos: lectura de la iglesia" on public.cafeteria_productos;
create policy "cafeteria_productos: lectura de la iglesia"
  on public.cafeteria_productos for select to authenticated
  using (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "cafeteria_productos: registro de la iglesia" on public.cafeteria_productos;
create policy "cafeteria_productos: registro de la iglesia"
  on public.cafeteria_productos for insert to authenticated
  with check (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "cafeteria_productos: líder actualiza" on public.cafeteria_productos;
create policy "cafeteria_productos: líder actualiza"
  on public.cafeteria_productos for update to authenticated
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "cafeteria_productos: líder elimina" on public.cafeteria_productos;
create policy "cafeteria_productos: líder elimina"
  on public.cafeteria_productos for delete to authenticated
  using (public.can_manage_org(organization_id));

drop policy if exists "cafeteria_ventas: lectura de la iglesia" on public.cafeteria_ventas;
create policy "cafeteria_ventas: lectura de la iglesia"
  on public.cafeteria_ventas for select to authenticated
  using (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "cafeteria_ventas: registro de la iglesia" on public.cafeteria_ventas;
create policy "cafeteria_ventas: registro de la iglesia"
  on public.cafeteria_ventas for insert to authenticated
  with check (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "cafeteria_ventas: líder actualiza" on public.cafeteria_ventas;
create policy "cafeteria_ventas: líder actualiza"
  on public.cafeteria_ventas for update to authenticated
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "cafeteria_ventas: líder elimina" on public.cafeteria_ventas;
create policy "cafeteria_ventas: líder elimina"
  on public.cafeteria_ventas for delete to authenticated
  using (public.can_manage_org(organization_id));

drop policy if exists "cafeteria_venta_items: lectura de la iglesia" on public.cafeteria_venta_items;
create policy "cafeteria_venta_items: lectura de la iglesia"
  on public.cafeteria_venta_items for select to authenticated
  using (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "cafeteria_venta_items: registro de la iglesia" on public.cafeteria_venta_items;
create policy "cafeteria_venta_items: registro de la iglesia"
  on public.cafeteria_venta_items for insert to authenticated
  with check (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));

drop policy if exists "cafeteria_venta_items: líder actualiza" on public.cafeteria_venta_items;
create policy "cafeteria_venta_items: líder actualiza"
  on public.cafeteria_venta_items for update to authenticated
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));

drop policy if exists "cafeteria_venta_items: corrección de la iglesia" on public.cafeteria_venta_items;
create policy "cafeteria_venta_items: corrección de la iglesia"
  on public.cafeteria_venta_items for delete to authenticated
  using (organization_id = public.user_organization_id() or public.can_manage_org(organization_id));