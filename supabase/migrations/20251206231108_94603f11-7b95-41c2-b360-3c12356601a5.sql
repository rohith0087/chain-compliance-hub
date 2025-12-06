-- Fix the handle_new_user trigger to cast TEXT directly to app_role enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role_text text;
  user_role_enum user_role;
BEGIN
  -- Determine the user's role from raw_user_meta_data
  IF NEW.raw_user_meta_data->'roles' IS NOT NULL AND jsonb_array_length(NEW.raw_user_meta_data->'roles') > 0 THEN
    user_role_text := NEW.raw_user_meta_data->'roles'->>0;
  ELSIF NEW.raw_user_meta_data->>'company_type' IS NOT NULL THEN
    user_role_text := NEW.raw_user_meta_data->>'company_type';
  ELSE
    user_role_text := 'supplier';
  END IF;
  
  -- Convert string to user_role enum for profiles table
  user_role_enum := user_role_text::user_role;
  
  -- Insert profile with correct roles array
  INSERT INTO public.profiles (id, email, full_name, roles, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    ARRAY[user_role_enum],
    NOW()
  );
  
  -- Insert into user_roles table - cast TEXT directly to app_role (not enum-to-enum)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_text::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Insert missing user_roles record for tmsnxakz@hotlinkimg.com
INSERT INTO user_roles (user_id, role)
VALUES ('ca2c4be0-d6cd-4263-9c5f-e2950e397721', 'supplier')
ON CONFLICT (user_id, role) DO NOTHING;