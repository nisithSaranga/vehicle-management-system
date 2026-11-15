-- Run manually in the Supabase SQL Editor when a fresh application dataset is required.
-- This preserves tables, policies, functions, storage buckets, profiles, and auth users.
begin;

truncate table
  public.inspection_items,
  public.reminder_logs,
  public.notifications,
  public.mileage_records,
  public.vehicle_documents,
  public.compliance_records,
  public.maintenance_attachments,
  public.maintenance_records,
  public.fuel_records,
  public.inspections,
  public.vehicles
restart identity cascade;

commit;
