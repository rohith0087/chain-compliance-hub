
-- Broadcast Help Center update notification to all buyers and suppliers
INSERT INTO notifications (id, user_id, title, message, type, read, created_at)
SELECT 
  gen_random_uuid(),
  profile_id,
  '🎉 Help Center Updated!',
  'You can now view your previous and live support tickets, and chat directly with our support team for open tickets. Click the help button to explore!',
  'system_announcement',
  false,
  NOW()
FROM (
  SELECT DISTINCT profile_id FROM buyers WHERE profile_id IS NOT NULL
  UNION
  SELECT DISTINCT profile_id FROM suppliers WHERE profile_id IS NOT NULL
) AS all_users;
