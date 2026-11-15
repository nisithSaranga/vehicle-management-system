alter table public.vehicles
  add column energy_type text not null default 'fuel'
  check (energy_type in ('fuel', 'electric'));

update public.vehicles
set energy_type = 'electric'
where lower(coalesce(fuel_type, '')) = 'electric';
