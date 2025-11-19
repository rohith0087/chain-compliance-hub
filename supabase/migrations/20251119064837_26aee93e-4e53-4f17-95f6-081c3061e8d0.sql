-- Add unique constraint to agent_configurations table
-- This ensures each company can only have one configuration per agent type
ALTER TABLE agent_configurations
ADD CONSTRAINT agent_configurations_unique_config 
UNIQUE (agent_type, company_id, company_type);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_agent_configurations_lookup 
ON agent_configurations(company_id, company_type, agent_type);