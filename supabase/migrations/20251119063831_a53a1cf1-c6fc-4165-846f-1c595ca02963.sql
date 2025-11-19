-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_buyer_agent_config ON buyers;
DROP TRIGGER IF EXISTS create_supplier_agent_config ON suppliers;
DROP FUNCTION IF EXISTS create_default_agent_configs();

-- Create improved function that properly handles RLS
CREATE OR REPLACE FUNCTION create_default_agent_configs()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create buyer agent config
  IF TG_TABLE_NAME = 'buyers' THEN
    INSERT INTO agent_configurations (
      agent_type, 
      company_id, 
      company_type, 
      enabled, 
      settings,
      created_by
    )
    VALUES (
      'buyer',
      NEW.id,
      'buyer',
      true,
      jsonb_build_object(
        'auto_approve_threshold', 0.8,
        'auto_reject_threshold', 0.3,
        'check_interval_minutes', 5,
        'max_processing_time_minutes', 30
      ),
      NEW.profile_id
    )
    ON CONFLICT (agent_type, company_id, company_type) DO NOTHING;
  END IF;
  
  -- Create supplier agent config
  IF TG_TABLE_NAME = 'suppliers' THEN
    INSERT INTO agent_configurations (
      agent_type, 
      company_id, 
      company_type, 
      enabled, 
      settings,
      created_by
    )
    VALUES (
      'supplier',
      NEW.id,
      'supplier',
      true,
      jsonb_build_object(
        'auto_submit_threshold', 0.9,
        'check_interval_minutes', 10,
        'expiry_notification_days', 30,
        'max_processing_time_minutes', 20
      ),
      NEW.profile_id
    )
    ON CONFLICT (agent_type, company_id, company_type) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER create_buyer_agent_config
  AFTER INSERT ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION create_default_agent_configs();

CREATE TRIGGER create_supplier_agent_config
  AFTER INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION create_default_agent_configs();