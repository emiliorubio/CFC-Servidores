-- Al eliminar una iglesia fallaba si tenía canciones en el módulo de Adoración:
-- service_songs.organization_id no tenía "on delete cascade".
alter table public.service_songs
  drop constraint if exists service_songs_organization_id_fkey,
  add constraint service_songs_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade;