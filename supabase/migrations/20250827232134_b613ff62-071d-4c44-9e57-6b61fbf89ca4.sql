-- Create function to automatically refresh knowledge base when documents are approved/updated
CREATE OR REPLACE FUNCTION public.auto_refresh_knowledge_base()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_company_type TEXT;
BEGIN
  -- Determine company ID and type based on the document request
  IF TG_TABLE_NAME = 'document_uploads' THEN
    -- Get company info from document request
    SELECT 
      CASE 
        WHEN dr.buyer_id IS NOT NULL THEN dr.buyer_id
        WHEN dr.supplier_id IS NOT NULL THEN dr.supplier_id
        ELSE NULL
      END,
      CASE 
        WHEN dr.buyer_id IS NOT NULL THEN 'buyer'
        WHEN dr.supplier_id IS NOT NULL THEN 'supplier'
        ELSE NULL
      END
    INTO v_company_id, v_company_type
    FROM document_requests dr
    WHERE dr.id = COALESCE(NEW.request_id, OLD.request_id);
    
  ELSIF TG_TABLE_NAME = 'document_requests' THEN
    -- Get company info directly from document request
    SELECT 
      CASE 
        WHEN NEW.buyer_id IS NOT NULL THEN NEW.buyer_id
        WHEN NEW.supplier_id IS NOT NULL THEN NEW.supplier_id
        ELSE NULL
      END,
      CASE 
        WHEN NEW.buyer_id IS NOT NULL THEN 'buyer'
        WHEN NEW.supplier_id IS NOT NULL THEN 'supplier'
        ELSE NULL
      END
    INTO v_company_id, v_company_type;
  END IF;

  -- Only trigger knowledge refresh for approved documents
  IF (TG_TABLE_NAME = 'document_uploads' AND NEW.status = 'approved' AND OLD.status != 'approved') OR
     (TG_TABLE_NAME = 'document_requests' AND NEW.status = 'approved' AND OLD.status != 'approved') THEN
    
    -- Call the knowledge populator edge function asynchronously
    PERFORM net.http_post(
      url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/knowledge-populator',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body := jsonb_build_object(
        'company_id', v_company_id,
        'company_type', v_company_type,
        'incremental', true
      )
    );
    
    RAISE LOG 'Triggered knowledge base refresh for company % (type: %)', v_company_id, v_company_type;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for automatic knowledge base updates
DROP TRIGGER IF EXISTS trigger_auto_refresh_knowledge_uploads ON document_uploads;
CREATE TRIGGER trigger_auto_refresh_knowledge_uploads
  AFTER UPDATE ON document_uploads
  FOR EACH ROW
  EXECUTE FUNCTION auto_refresh_knowledge_base();

DROP TRIGGER IF EXISTS trigger_auto_refresh_knowledge_requests ON document_requests;
CREATE TRIGGER trigger_auto_refresh_knowledge_requests
  AFTER UPDATE ON document_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_refresh_knowledge_base();

-- Create function to clean up expired knowledge entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_knowledge_entries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired knowledge entries
  DELETE FROM ai_knowledge_entries 
  WHERE expires_at IS NOT NULL AND expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE LOG 'Cleaned up % expired knowledge entries', deleted_count;
  RETURN deleted_count;
END;
$$;

-- Create function to get companies that need knowledge base population
CREATE OR REPLACE FUNCTION public.get_companies_for_knowledge_refresh()
RETURNS TABLE(company_id UUID, company_type TEXT, company_name TEXT, document_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Return companies with approved documents but missing or outdated knowledge entries
  RETURN QUERY
  WITH company_docs AS (
    -- Get suppliers with approved documents
    SELECT 
      s.id as company_id,
      'supplier'::TEXT as company_type,
      s.company_name,
      COUNT(du.id) as document_count
    FROM suppliers s
    JOIN document_requests dr ON dr.supplier_id = s.id
    JOIN document_uploads du ON du.request_id = dr.id
    WHERE du.status = 'approved'
    GROUP BY s.id, s.company_name
    
    UNION ALL
    
    -- Get buyers with approved documents
    SELECT 
      b.id as company_id,
      'buyer'::TEXT as company_type,
      b.company_name,
      COUNT(du.id) as document_count
    FROM buyers b
    JOIN document_requests dr ON dr.buyer_id = b.id
    JOIN document_uploads du ON du.request_id = dr.id
    WHERE du.status = 'approved'
    GROUP BY b.id, b.company_name
  ),
  knowledge_status AS (
    SELECT 
      cd.company_id,
      cd.company_type,
      cd.company_name,
      cd.document_count,
      COUNT(ake.id) as knowledge_entries
    FROM company_docs cd
    LEFT JOIN ai_knowledge_entries ake ON (
      ake.company_id = cd.company_id AND 
      ake.company_type = cd.company_type AND
      (ake.expires_at IS NULL OR ake.expires_at > now())
    )
    GROUP BY cd.company_id, cd.company_type, cd.company_name, cd.document_count
  )
  SELECT 
    ks.company_id,
    ks.company_type,
    ks.company_name,
    ks.document_count
  FROM knowledge_status ks
  WHERE ks.knowledge_entries = 0 OR ks.knowledge_entries < (ks.document_count / 5); -- Refresh if less than 20% coverage
END;
$$;