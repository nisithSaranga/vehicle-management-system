create type public.user_role as enum ('administrator', 'management');
create type public.vehicle_status as enum ('active', 'archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role public.user_role not null default 'management',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  make text not null,
  model text not null,
  vehicle_type text not null,
  manufacturing_year integer not null check (manufacturing_year between 1886 and 2200),
  department text,
  assigned_driver text,
  fuel_type text,
  status public.vehicle_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  inspector_id uuid not null references public.profiles(id),
  inspection_date date not null,
  week_start_date date not null,
  odometer_reading integer not null check (odometer_reading >= 0),
  overall_condition text not null,
  remarks text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (vehicle_id, week_start_date)
);

create table public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  item_name text not null,
  item_status text not null,
  remarks text
);

create table public.mileage_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  recorded_by uuid not null references public.profiles(id),
  odometer_reading integer not null check (odometer_reading >= 0),
  reading_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  document_type text not null,
  reference_number text,
  issue_date date,
  expiry_date date,
  file_path text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.compliance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  compliance_type text not null check (compliance_type in ('Revenue Licence', 'Emission Test', 'Insurance')),
  issue_date date,
  expiry_date date,
  completion_date date,
  reference_number text,
  file_path text,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  service_date date not null,
  odometer_reading integer not null check (odometer_reading >= 0),
  service_type text not null,
  description text,
  provider text,
  cost numeric(12, 2) check (cost is null or cost >= 0),
  next_service_date date,
  next_service_mileage integer check (next_service_mileage is null or next_service_mileage >= 0),
  document_path text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id),
  vehicle_id uuid references public.vehicles(id),
  notification_type text not null,
  title text not null,
  message text not null,
  due_date date,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id),
  related_record_id uuid not null,
  reminder_type text not null,
  reminder_date date not null,
  channel text not null,
  created_at timestamptz not null default now(),
  unique (related_record_id, reminder_type, reminder_date)
);

create index vehicles_registration_number_idx on public.vehicles (registration_number);
create index inspections_vehicle_id_idx on public.inspections (vehicle_id);
create index inspections_inspection_date_idx on public.inspections (inspection_date);
create index mileage_records_vehicle_id_idx on public.mileage_records (vehicle_id);
create index vehicle_documents_expiry_date_idx on public.vehicle_documents (expiry_date);
create index compliance_records_vehicle_id_idx on public.compliance_records (vehicle_id);
create index compliance_records_expiry_date_idx on public.compliance_records (expiry_date);
create index compliance_records_status_idx on public.compliance_records (status);
create index maintenance_records_vehicle_id_idx on public.maintenance_records (vehicle_id);
create index notifications_recipient_id_idx on public.notifications (recipient_id);

create or replace function public.is_administrator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'administrator'
  );
$$;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.inspections enable row level security;
alter table public.inspection_items enable row level security;
alter table public.mileage_records enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.compliance_records enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.notifications enable row level security;
alter table public.reminder_logs enable row level security;

create policy "authenticated users can view profiles"
  on public.profiles for select to authenticated using (true);
create policy "authenticated users can view fleet data"
  on public.vehicles for select to authenticated using (true);
create policy "administrators can manage vehicles"
  on public.vehicles for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "authenticated users can view inspections"
  on public.inspections for select to authenticated using (true);
create policy "administrators can manage inspections"
  on public.inspections for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "authenticated users can view inspection items"
  on public.inspection_items for select to authenticated using (true);
create policy "administrators can manage inspection items"
  on public.inspection_items for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "authenticated users can view operational records"
  on public.mileage_records for select to authenticated using (true);
create policy "administrators can manage operational records"
  on public.mileage_records for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "authenticated users can view documents"
  on public.vehicle_documents for select to authenticated using (true);
create policy "administrators can manage documents"
  on public.vehicle_documents for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "authenticated users can view compliance"
  on public.compliance_records for select to authenticated using (true);
create policy "administrators can manage compliance"
  on public.compliance_records for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "authenticated users can view maintenance"
  on public.maintenance_records for select to authenticated using (true);
create policy "administrators can manage maintenance"
  on public.maintenance_records for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "users can view their notifications"
  on public.notifications for select to authenticated
  using (recipient_id is null or recipient_id = (select auth.uid()));
create policy "administrators can manage notifications"
  on public.notifications for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

create policy "administrators can view reminder logs"
  on public.reminder_logs for select to authenticated using (public.is_administrator());
create policy "administrators can manage reminder logs"
  on public.reminder_logs for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do nothing;

create policy "authenticated users can read vehicle documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'vehicle-documents');
create policy "administrators can upload vehicle documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-documents' and public.is_administrator());
create policy "administrators can update vehicle documents"
  on storage.objects for update to authenticated
  using (bucket_id = 'vehicle-documents' and public.is_administrator())
  with check (bucket_id = 'vehicle-documents' and public.is_administrator());
