-- Fix handle_new_user trigger to set profiles.roles from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  user_role_enum user_role;
BEGIN
  -- Determine the user's role from raw_user_meta_data
  -- Priority: roles array -> company_type -> default to 'supplier'
  IF NEW.raw_user_meta_data->'roles' IS NOT NULL AND jsonb_array_length(NEW.raw_user_meta_data->'roles') > 0 THEN
    user_role := NEW.raw_user_meta_data->'roles'->>0;
  ELSIF NEW.raw_user_meta_data->>'company_type' IS NOT NULL THEN
    user_role := NEW.raw_user_meta_data->>'company_type';
  ELSE
    user_role := 'supplier';
  END IF;
  
  -- Convert string to enum
  user_role_enum := user_role::user_role;
  
  -- Insert profile with correct roles array
  INSERT INTO public.profiles (id, email, full_name, roles, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    ARRAY[user_role_enum],
    NOW()
  );
  
  -- Also insert into user_roles table (authoritative)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_enum::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Fix the affected user's profile.roles to match their user_roles entry
UPDATE public.profiles p
SET roles = ARRAY['buyer'::user_role]
WHERE p.email = 'tabokif457@bialode.com'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role = 'buyer'
  );