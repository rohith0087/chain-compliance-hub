
-- Drop and recreate the enum and function to ensure clean state
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Ensure enum types exist
DO $$ BEGIN
    DROP TYPE IF EXISTS public.user_role CASCADE;
    CREATE TYPE public.user_role AS ENUM ('buyer', 'supplier', 'admin');
EXCEPTION
    WHEN others THEN null;
END $$;

-- Create the trigger function with proper array handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_roles public.user_role[];
BEGIN
  -- Get roles from metadata, default to supplier if not provided
  IF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::public.user_role
    ) INTO user_roles;
  ELSE
    user_roles := ARRAY['supplier']::public.user_role[];
  END IF;

  INSERT INTO public.profiles (id, email, full_name, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_roles
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
