drop policy if exists "administrators can manage vehicles" on public.vehicles;

create policy "administrators can create vehicles"
  on public.vehicles for insert to authenticated
  with check (public.is_administrator());

create policy "administrators can update vehicles"
  on public.vehicles for update to authenticated
  using (public.is_administrator())
  with check (public.is_administrator());
