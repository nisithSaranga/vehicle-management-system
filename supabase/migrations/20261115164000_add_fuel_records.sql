create table public.fuel_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  recorded_by uuid not null references public.profiles(id),
  refuel_date date not null,
  fuel_type text not null check (fuel_type in ('Petrol', 'Diesel')),
  litres numeric(12, 3) not null check (litres > 0),
  cost_per_litre numeric(12, 2) not null check (cost_per_litre >= 0),
  total_cost numeric(12, 2) not null check (total_cost >= 0),
  odometer_reading numeric(12, 2) check (odometer_reading is null or odometer_reading >= 0),
  fuel_station text,
  receipt_path text,
  notes text,
  created_at timestamptz not null default now()
);

create index fuel_records_vehicle_id_idx on public.fuel_records (vehicle_id);
create index fuel_records_refuel_date_idx on public.fuel_records (refuel_date);

alter table public.fuel_records enable row level security;

create policy "authenticated users can view fuel records"
  on public.fuel_records for select to authenticated using (true);
create policy "administrators can manage fuel records"
  on public.fuel_records for all to authenticated
  using (public.is_administrator()) with check (public.is_administrator());
