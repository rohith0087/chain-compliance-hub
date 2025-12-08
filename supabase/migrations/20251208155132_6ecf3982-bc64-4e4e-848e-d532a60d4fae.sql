-- Delete the unnecessary Main Office branch from Deb El Food Products buyer company
-- This branch was created by the previous migration but is redundant since 4 real branches already exist
DELETE FROM company_branches 
WHERE id = '66a0b8e7-b32c-4a7a-ac9c-35440375bdab'
  AND branch_name = 'Main Office'
  AND company_id = '5d162b97-0a03-4439-9eaf-9fb7c1fbe4b1'
  AND company_type = 'buyer';