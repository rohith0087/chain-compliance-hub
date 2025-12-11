-- Fix handle_new_user trigger to process ALL roles from metadata array (not just the first one)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_roles_array user_role[] := ARRAY[]::user_role[];
  role_text text;
  i int;
BEGIN
  -- Process ALL roles from metadata array (fix: was only taking first element)
  IF NEW.raw_user_meta_data->'roles' IS NOT NULL AND jsonb_array_length(NEW.raw_user_meta_data->'roles') > 0 THEN
    FOR i IN 0..jsonb_array_length(NEW.raw_user_meta_data->'roles') - 1 LOOP
      role_text := NEW.raw_user_meta_data->'roles'->>i;
      user_roles_array := array_append(user_roles_array, role_text::user_role);
    END LOOP;
  ELSIF NEW.raw_user_meta_data->>'company_type' IS NOT NULL THEN
    user_roles_array := ARRAY[(NEW.raw_user_meta_data->>'company_type')::user_role];
  ELSE
    user_roles_array := ARRAY['supplier'::user_role];
  END IF;
  
  -- Insert profile with ALL roles
  INSERT INTO public.profiles (id, email, full_name, roles, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    user_roles_array,
    NOW()
  );
  
  -- Insert ALL roles into user_roles table
  FOREACH role_text IN ARRAY user_roles_array LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, role_text::text::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Fix the existing test user: add missing buyer role
UPDATE profiles 
SET roles = ARRAY['supplier', 'buyer']::user_role[]
WHERE email = 'test-kl0sbth4u@srv1.mail-tester.com';

-- Add buyer role to user_roles table for test user
INSERT INTO user_roles (user_id, role)
SELECT id, 'buyer'::app_role
FROM profiles
WHERE email = 'test-kl0sbth4u@srv1.mail-tester.com'
ON CONFLICT (user_id, role) DO NOTHING;