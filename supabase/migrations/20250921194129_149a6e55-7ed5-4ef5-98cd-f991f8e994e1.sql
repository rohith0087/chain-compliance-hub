-- Ensure pgcrypto is in the extensions schema (not public)
CREATE SCHEMA IF NOT EXISTS extensions;
-- Move pgcrypto into the extensions schema if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pgcrypto' AND n.nspname <> 'extensions'
  ) THEN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  END IF;
END $$;