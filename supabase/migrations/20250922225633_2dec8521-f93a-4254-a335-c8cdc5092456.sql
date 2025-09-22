-- Fix security warning: Set search_path for security definer functions
ALTER FUNCTION create_default_agent_configs() SET search_path = public;
ALTER FUNCTION update_agent_config_updated_at() SET search_path = public;