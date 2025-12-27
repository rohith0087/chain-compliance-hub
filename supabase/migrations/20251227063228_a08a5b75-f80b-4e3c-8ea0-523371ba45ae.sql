-- Add new request notification settings columns to buyer_notification_settings
ALTER TABLE public.buyer_notification_settings
ADD COLUMN IF NOT EXISTS new_request_in_app_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS new_request_email_enabled boolean NOT NULL DEFAULT false;