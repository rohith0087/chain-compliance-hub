alter table public.document_requests
  alter column public_reference set default (
    'R2C-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  );
