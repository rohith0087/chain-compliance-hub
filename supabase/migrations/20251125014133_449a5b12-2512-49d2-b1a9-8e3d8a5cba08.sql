-- Fix type mismatch in handle_new_user() trigger
-- Change user_role::user_role to user_role::app_role

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  user_role text;
  metadata_company_type text;
BEGIN
  -- Extract company_type from raw_user_meta_data (passed by edge function during auth.admin.createUser)
  metadata_company_type := NEW.raw_user_meta_data->>'company_type';
  
  -- Determine role based on company_type
  IF metadata_company_type = 'buyer' THEN
    user_role := 'buyer';
  ELSIF metadata_company_type = 'supplier' THEN
    user_role := 'supplier';
  ELSE
    -- Check if roles array exists in metadata
    IF NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
      user_role := COALESCE(
        NEW.raw_user_meta_data->'roles'->>0,
        'supplier'
      );
    ELSE
      user_role := 'supplier'; -- Default fallback
    END IF;
  END IF;

  -- Insert into profiles table
  INSERT INTO public.profiles (id, email, full_name, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW()
  );

  -- Insert into user_roles table with correct type cast
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role::app_role);

  RAISE LOG 'handle_new_user: Created profile and role % for user %', user_role, NEW.email;

  RETURN NEW;
END;
$$;