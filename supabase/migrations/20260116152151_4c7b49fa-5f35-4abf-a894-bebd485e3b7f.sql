-- Enable email notifications for all existing suppliers who have it disabled
UPDATE supplier_notification_settings
SET new_request_email_enabled = true,
    updated_at = NOW()
WHERE new_request_email_enabled = false;