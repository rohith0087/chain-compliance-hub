
-- Ensure enum types exist before updating the function
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('buyer', 'supplier', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update the trigger function to handle roles from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_roles user_role[];
BEGIN
  -- Get roles from metadata, default to supplier if not provided
  IF NEW.raw_user_meta_data ? 'roles' THEN
    user_roles := ARRAY(SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles'))::user_role[];
  ELSE
    user_roles := ARRAY['supplier']::user_role[];
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
