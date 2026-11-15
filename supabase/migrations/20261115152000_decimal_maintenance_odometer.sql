alter table public.maintenance_records
  alter column odometer_reading type numeric using odometer_reading::numeric;
