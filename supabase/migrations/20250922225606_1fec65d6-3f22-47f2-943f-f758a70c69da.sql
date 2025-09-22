-- Create agent_configurations table if it doesn't exist
CREATE TABLE IF NOT EXISTS agent_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (agent_type IN ('supplier', 'buyer')),
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('supplier', 'buyer')),
  enabled BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  status TEXT DEFAULT 'idle',
  last_active_at TIMESTAMP WITH TIME ZONE,
  operation TEXT,
  operation_details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(agent_type, company_id, company_type)
);

-- Enable RLS
ALTER TABLE agent_configurations ENABLE ROW LEVEL SECURITY;

-- Create policies for agent_configurations
CREATE POLICY "Users can view their company agents" ON agent_configurations
  FOR SELECT USING (
    (company_type = 'buyer' AND company_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )) OR
    (company_type = 'supplier' AND company_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    ))
  );

CREATE POLICY "Users can manage their company agents" ON agent_configurations
  FOR ALL USING (
    (company_type = 'buyer' AND company_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )) OR
    (company_type = 'supplier' AND company_id IN (
      SELECT id FROM suppliers WHERE profile_id = auth.uid()
    ))
  );

-- Insert default agent configurations for existing buyers
INSERT INTO agent_configurations (agent_type, company_id, company_type, enabled, settings)
SELECT 
  'buyer' as agent_type,
  b.id as company_id,
  'buyer' as company_type,
  true as enabled,
  jsonb_build_object(
    'auto_approve_threshold', 0.8,
    'auto_reject_threshold', 0.3,
    'check_interval_minutes', 5,
    'max_processing_time_minutes', 30
  ) as settings
FROM buyers b
WHERE NOT EXISTS (
  SELECT 1 FROM agent_configurations ac 
  WHERE ac.agent_type = 'buyer' AND ac.company_id = b.id AND ac.company_type = 'buyer'
);

-- Insert default agent configurations for existing suppliers
INSERT INTO agent_configurations (agent_type, company_id, company_type, enabled, settings)
SELECT 
  'supplier' as agent_type,
  s.id as company_id,
  'supplier' as company_type,
  true as enabled,
  jsonb_build_object(
    'auto_submit_threshold', 0.9,
    'check_interval_minutes', 10,
    'expiry_notification_days', 30,
    'max_processing_time_minutes', 20
  ) as settings
FROM suppliers s
WHERE NOT EXISTS (
  SELECT 1 FROM agent_configurations ac 
  WHERE ac.agent_type = 'supplier' AND ac.company_id = s.id AND ac.company_type = 'supplier'
);

-- Create function to automatically create agent configs for new companies
CREATE OR REPLACE FUNCTION create_default_agent_configs()
RETURNS TRIGGER AS $$
BEGIN
  -- Create buyer agent config
  IF TG_TABLE_NAME = 'buyers' THEN
    INSERT INTO agent_configurations (agent_type, company_id, company_type, enabled, settings)
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
      )
    );
  END IF;
  
  -- Create supplier agent config
  IF TG_TABLE_NAME = 'suppliers' THEN
    INSERT INTO agent_configurations (agent_type, company_id, company_type, enabled, settings)
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
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for automatic agent config creation
DROP TRIGGER IF EXISTS create_buyer_agent_config ON buyers;
CREATE TRIGGER create_buyer_agent_config
  AFTER INSERT ON buyers
  FOR EACH ROW
  EXECUTE FUNCTION create_default_agent_configs();

DROP TRIGGER IF EXISTS create_supplier_agent_config ON suppliers;
CREATE TRIGGER create_supplier_agent_config
  AFTER INSERT ON suppliers
  FOR EACH ROW
  EXECUTE FUNCTION create_default_agent_configs();

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_agent_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agent_configurations_updated_at ON agent_configurations;
CREATE TRIGGER update_agent_configurations_updated_at
  BEFORE UPDATE ON agent_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_config_updated_at();