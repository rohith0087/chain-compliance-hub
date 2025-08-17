-- Add status tracking fields to agent_configurations
ALTER TABLE agent_configurations 
ADD COLUMN last_active timestamp with time zone DEFAULT now(),
ADD COLUMN current_status text DEFAULT 'offline',
ADD COLUMN current_operation text,
ADD COLUMN processing_details jsonb DEFAULT '{}',
ADD COLUMN estimated_completion timestamp with time zone;

-- Add more detailed fields to agent_activities for AI thinking process
ALTER TABLE agent_activities
ADD COLUMN processing_steps jsonb DEFAULT '[]',
ADD COLUMN reasoning text,
ADD COLUMN intermediate_results jsonb DEFAULT '{}',
ADD COLUMN operation_duration_ms integer;

-- Enable realtime for agent tables
ALTER TABLE agent_configurations REPLICA IDENTITY FULL;
ALTER TABLE agent_activities REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE agent_configurations;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_activities;