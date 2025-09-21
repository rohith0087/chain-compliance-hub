-- Insert subscription plan configurations
INSERT INTO public.subscription_plan_configs (
  plan_type, plan_name, monthly_price_cents, monthly_credits, max_reports_per_month, 
  features, stripe_price_id, stripe_product_id, target_audience
) VALUES 
(
  'buyer_basic', 'Buyer Basic Plan', 2900, 50, 20,
  '{"ai_insights": false, "advanced_reports": false, "comparison_reports": true, "priority_support": false}',
  'price_1S9wBhAKCMksc2ZODimNDCKW', 'prod_T68SDzX28rYip7', 'buyer'
),
(
  'buyer_professional', 'Buyer Professional Plan', 9900, 200, 100,
  '{"ai_insights": true, "advanced_reports": true, "comparison_reports": true, "priority_support": true}',
  'price_1S9wCIAKCMksc2ZOR0i2gly9', 'prod_T68TpRqvlmcWNR', 'buyer'
),
(
  'buyer_enterprise', 'Buyer Enterprise Plan', 29900, 999999, 999999,
  '{"ai_insights": true, "advanced_reports": true, "comparison_reports": true, "priority_support": true, "unlimited_reports": true}',
  'price_1S9wCwAKCMksc2ZOJDcBl0DT', 'prod_T68Tz4L9lXjbjC', 'buyer'
),
(
  'supplier_starter', 'Supplier Starter Plan', 1900, 30, 10,
  '{"document_templates": true, "basic_reports": true, "email_support": true}',
  'price_1S9wDGAKCMksc2ZOJmptQe6l', 'prod_T68UT3x2nRu4dl', 'supplier'
),
(
  'supplier_professional', 'Supplier Professional Plan', 5900, 100, 50,
  '{"document_templates": true, "basic_reports": true, "advanced_reports": true, "priority_support": true}',
  'price_1S9wDPAKCMksc2ZOGTT1RoZd', 'prod_T68UdkWZLlvrbq', 'supplier'
),
(
  'supplier_enterprise', 'Supplier Enterprise Plan', 19900, 999999, 999999,
  '{"document_templates": true, "basic_reports": true, "advanced_reports": true, "priority_support": true, "unlimited_reports": true}',
  'price_1S9wDiAKCMksc2ZOBLr0IcsR', 'prod_T68U6TWdLz6xoX', 'supplier'
);