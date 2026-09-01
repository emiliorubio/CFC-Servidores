-- Aísla el repertorio de cada iglesia. Las canciones existentes se asocian
-- al tenant de su culto antes de exigir el campo.
alter table public.service_songs
  add column if not exists organization_id uuid references public.organizations(id);

update public.service_songs as song
set organization_id = service.organization_id
from public.service_schedules as service
where song.service_schedule_id = service.id
  and song.organization_id is null;

alter table public.service_songs
  alter column organization_id set not null;

create index if not exists service_songs_organization_service_idx
  on public.service_songs (organization_id, service_schedule_id);
