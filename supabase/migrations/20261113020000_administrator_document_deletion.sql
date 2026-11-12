create policy "administrators can delete vehicle documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'vehicle-documents' and public.is_administrator());
