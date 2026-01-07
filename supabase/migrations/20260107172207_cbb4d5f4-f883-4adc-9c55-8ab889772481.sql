-- Upgrade rcrohith017@gmail.com to buyer_professional plan
INSERT INTO subscriptions (
  user_id,
  plan_type,
  status,
  current_period_start,
  current_period_end,
  monthly_credits,
  price_id
) VALUES (
  'e15a1767-453b-4cdb-9fda-0e62fdde71ac',
  'buyer_professional',
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',
  100,
  'manual_upgrade'
);

-- Update user credits to 100
UPDATE user_credits 
SET 
  available_credits = 100,
  updated_at = NOW()
WHERE user_id = 'e15a1767-453b-4cdb-9fda-0e62fdde71ac';