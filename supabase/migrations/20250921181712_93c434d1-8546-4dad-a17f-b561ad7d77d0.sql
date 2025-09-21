-- Add missing must_change_password column to platform_administrators table
ALTER TABLE platform_administrators 
ADD COLUMN must_change_password boolean DEFAULT true;