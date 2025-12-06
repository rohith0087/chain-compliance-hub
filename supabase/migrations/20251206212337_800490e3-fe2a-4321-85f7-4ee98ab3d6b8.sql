-- Remove bootstrap-related security risk functions
DROP FUNCTION IF EXISTS public.accept_bootstrap_admin(text);
DROP FUNCTION IF EXISTS public.create_bootstrap_super_admin(text, text);