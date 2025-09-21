-- Add super_admin role to user_role enum (separate transaction)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';