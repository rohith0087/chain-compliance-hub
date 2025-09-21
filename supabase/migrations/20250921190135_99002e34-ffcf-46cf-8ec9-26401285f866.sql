-- Update platform admin password reset function to call edge function for email
CREATE OR REPLACE FUNCTION platform_admin_reset_password(user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  temp_password TEXT;
  user_email TEXT;
  user_name TEXT;
  result JSON;
BEGIN
  -- Check if caller is platform admin
  IF NOT is_platform_admin(auth.uid()) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Unauthorized: Platform admin access required'
    );
  END IF;

  -- Get user details
  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email) 
  INTO user_email, user_name
  FROM auth.users 
  WHERE id = user_id;

  IF user_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  -- Generate secure temporary password (12 characters with mix of chars)
  temp_password := array_to_string(
    ARRAY(
      SELECT CASE (RANDOM() * 3)::INTEGER
        WHEN 0 THEN chr(ascii('A') + (RANDOM() * 25)::INTEGER)
        WHEN 1 THEN chr(ascii('a') + (RANDOM() * 25)::INTEGER)
        ELSE chr(ascii('0') + (RANDOM() * 9)::INTEGER)
      END
      FROM generate_series(1, 12)
    ), ''
  );

  -- Update user password in auth.users and mark for forced reset
  UPDATE auth.users 
  SET 
    encrypted_password = crypt(temp_password, gen_salt('bf')),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || 
                        jsonb_build_object('must_reset_password', true, 'temp_password_expires', (now() + interval '24 hours')::text)
  WHERE id = user_id;

  -- Call the edge function to send email
  SELECT net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/send-password-reset',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := jsonb_build_object(
      'email', user_email,
      'name', user_name,
      'temp_password', temp_password,
      'admin_name', (SELECT full_name FROM platform_administrators WHERE auth_user_id = auth.uid())
    )
  ) INTO result;

  -- Log the password reset activity
  INSERT INTO platform_admin_audit_logs (admin_id, action_type, resource_type, resource_id, details)
  VALUES (
    auth.uid(),
    'password_reset',
    'user',
    user_id,
    jsonb_build_object(
      'user_email', user_email,
      'reset_time', now(),
      'email_sent', true
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Temporary password sent to user email',
    'temp_password_expires', (now() + interval '24 hours')::text
  );
END;
$$;