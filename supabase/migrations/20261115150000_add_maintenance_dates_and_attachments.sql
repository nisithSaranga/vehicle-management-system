alter table public.maintenance_records
  add column handover_date date,
  add column retrieval_date date;

create table public.maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  maintenance_record_id uuid not null references public.maintenance_records(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  attachment_type text not null check (attachment_type in ('Service Invoice', 'Receipt', 'Other')),
  file_path text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index maintenance_attachments_record_id_idx
  on public.maintenance_attachments (maintenance_record_id);
create index maintenance_attachments_vehicle_id_idx
  on public.maintenance_attachments (vehicle_id);

alter table public.maintenance_attachments enable row level security;

create policy "authenticated users can view maintenance attachments"
  on public.maintenance_attachments for select to authenticated using (true);
create policy "administrators can manage maintenance attachments"
  on public.maintenance_attachments for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());
