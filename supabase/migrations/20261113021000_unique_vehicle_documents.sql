create unique index if not exists vehicle_documents_unique_type_idx
  on public.vehicle_documents (vehicle_id, document_type)
  where document_type in ('Revenue Licence', 'Emission Test', 'Insurance');
