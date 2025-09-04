-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant access to pg_net functions
CREATE OR REPLACE FUNCTION grant_pg_net_access()
RETURNS void AS $$
BEGIN
  -- Grant usage on the net schema to authenticated users
  GRANT USAGE ON SCHEMA net TO authenticated, service_role;
  
  -- Grant execute on http_post and other net functions
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA net TO authenticated, service_role;
  
  -- Grant execute on specific functions that might be used
  GRANT EXECUTE ON FUNCTION net.http_post TO authenticated, service_role;
  GRANT EXECUTE ON FUNCTION net.http_get TO authenticated, service_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the grant function
SELECT grant_pg_net_access();