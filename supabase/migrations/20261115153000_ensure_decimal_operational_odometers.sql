alter table public.mileage_records
  alter column odometer_reading type numeric using odometer_reading::numeric;

alter table public.inspections
  alter column odometer_reading type numeric using odometer_reading::numeric;
