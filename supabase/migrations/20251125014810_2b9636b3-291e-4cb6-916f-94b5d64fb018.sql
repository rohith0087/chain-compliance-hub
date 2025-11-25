-- Fix handle_new_company triggers to pass company_type argument
-- This resolves the "company_type NULL constraint violation" error

-- Drop existing triggers
DROP TRIGGER IF EXISTS create_default_branch_for_buyer ON buyers;
DROP TRIGGER IF EXISTS create_default_branch_for_supplier ON suppliers;

-- Recreate with company_type arguments
CREATE TRIGGER create_default_branch_for_buyer
  AFTER INSERT ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_company('buyer');

CREATE TRIGGER create_default_branch_for_supplier
  AFTER INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_company('supplier');