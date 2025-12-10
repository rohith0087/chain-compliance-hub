-- Security hardening: Add CHECK constraints for input validation at database level

-- Profiles table constraints
ALTER TABLE profiles 
ADD CONSTRAINT profiles_full_name_length CHECK (full_name IS NULL OR char_length(full_name) <= 100),
ADD CONSTRAINT profiles_email_length CHECK (email IS NULL OR char_length(email) <= 255),
ADD CONSTRAINT profiles_company_name_length CHECK (company_name IS NULL OR char_length(company_name) <= 100);

-- Support tickets table constraints
ALTER TABLE support_tickets
ADD CONSTRAINT support_tickets_subject_length CHECK (char_length(subject) <= 200),
ADD CONSTRAINT support_tickets_description_length CHECK (char_length(description) <= 2000),
ADD CONSTRAINT support_tickets_user_email_length CHECK (user_email IS NULL OR char_length(user_email) <= 255),
ADD CONSTRAINT support_tickets_user_name_length CHECK (user_name IS NULL OR char_length(user_name) <= 100),
ADD CONSTRAINT support_tickets_company_name_length CHECK (company_name IS NULL OR char_length(company_name) <= 100);

-- Auth audit logs table constraints
ALTER TABLE auth_audit_logs
ADD CONSTRAINT auth_logs_user_email_length CHECK (char_length(user_email) <= 255),
ADD CONSTRAINT auth_logs_user_name_length CHECK (user_name IS NULL OR char_length(user_name) <= 100),
ADD CONSTRAINT auth_logs_action_valid CHECK (action IN ('login', 'logout', 'signup', 'password_reset'));