-- Fix the access_token default value to use base64 instead of base64url
-- PostgreSQL 17.4 doesn't support base64url encoding
ALTER TABLE public.document_shared_links 
ALTER COLUMN access_token 
SET DEFAULT encode(extensions.gen_random_bytes(32), 'base64');