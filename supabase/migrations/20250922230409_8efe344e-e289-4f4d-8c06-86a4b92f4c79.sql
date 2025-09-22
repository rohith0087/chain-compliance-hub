-- Fix agent_configurations RLS policies to use proper company access
DROP POLICY IF EXISTS "Users can manage agent configurations for their companies" ON agent_configurations;
DROP POLICY IF EXISTS "Users can view agent configurations for their companies" ON agent_configurations;

-- Create more specific policies for agent configurations
CREATE POLICY "Users can view agent configurations for their companies" 
ON agent_configurations FOR SELECT 
USING (
  (company_type = 'buyer' AND company_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )) OR 
  (company_type = 'supplier' AND company_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  ))
);

CREATE POLICY "Users can insert agent configurations for their companies" 
ON agent_configurations FOR INSERT 
WITH CHECK (
  (company_type = 'buyer' AND company_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )) OR 
  (company_type = 'supplier' AND company_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  ))
);

CREATE POLICY "Users can update agent configurations for their companies" 
ON agent_configurations FOR UPDATE 
USING (
  (company_type = 'buyer' AND company_id IN (
    SELECT id FROM buyers WHERE profile_id = auth.uid()
  )) OR 
  (company_type = 'supplier' AND company_id IN (
    SELECT id FROM suppliers WHERE profile_id = auth.uid()
  ))
);

-- Ensure agent configurations uses proper defaults
CREATE OR REPLACE FUNCTION create_default_agent_configs()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default supplier agent configuration
  IF NEW.company_type = 'supplier' THEN
    INSERT INTO agent_configurations (company_id, company_type, agent_type, enabled, settings)
    VALUES (NEW.company_id, 'supplier', 'supplier', false, '{"auto_submit": false, "auto_notify": true}'::jsonb)
    ON CONFLICT (company_id, company_type, agent_type) DO NOTHING;
  END IF;
  
  -- Create default buyer agent configuration  
  IF NEW.company_type = 'buyer' THEN
    INSERT INTO agent_configurations (company_id, company_type, agent_type, enabled, settings)
    VALUES (NEW.company_id, 'buyer', 'buyer', false, '{"auto_approve": false, "approval_threshold": 0.8}'::jsonb)
    ON CONFLICT (company_id, company_type, agent_type) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;