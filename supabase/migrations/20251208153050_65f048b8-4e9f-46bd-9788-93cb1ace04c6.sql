-- Create buyer company "Deb El Food Products" for pfontano@debelfoods.com
-- The handle_new_company('buyer') trigger will automatically create:
-- 1. Main Office branch in company_branches
-- 2. company_users record with company_admin role

INSERT INTO buyers (
  profile_id,
  company_name,
  contact_email,
  industry,
  phone,
  address
) VALUES (
  'a9e7e7c2-dcf7-430c-a187-a6d708dd2866',
  'Deb El Food Products',
  'pfontano@debelfoods.com',
  'Food & Beverage',
  '845-434-7560',
  '64 Kutger Road, Thompsonville, NY 12784'
);