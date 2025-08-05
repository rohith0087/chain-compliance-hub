-- Fix remaining functions with missing search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_roles user_role[];
BEGIN
  -- Get roles from metadata, default to supplier if not provided
  IF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
    SELECT ARRAY(
      SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::user_role
    ) INTO user_roles;
  ELSE
    user_roles := ARRAY['supplier']::user_role[];
  END IF;

  INSERT INTO profiles (id, email, full_name, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_roles
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_title text, p_message text, p_type text, p_reference_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, reference_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_reference_id)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;