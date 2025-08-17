-- Fix function search path security issues
CREATE OR REPLACE FUNCTION sync_document_upload_status()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Update all document uploads for this request to match the request status
  UPDATE document_uploads 
  SET status = CASE 
    WHEN NEW.status = 'completed' THEN 'approved'
    WHEN NEW.status = 'rejected' THEN 'rejected'
    WHEN NEW.status = 'pending' THEN 'pending_review'
    ELSE NEW.status
  END,
  updated_at = now()
  WHERE request_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Fix search function security issues
CREATE OR REPLACE FUNCTION search_relevant_documents(
  query_text TEXT,
  user_company_id UUID,
  user_company_type TEXT,
  match_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  document_type TEXT,
  supplier_name TEXT,
  expiration_date DATE,
  status TEXT,
  file_path TEXT,
  metadata JSONB,
  relevance_score NUMERIC
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    du.id,
    dr.title,
    dr.document_type,
    s.company_name as supplier_name,
    du.expiration_date,
    dr.status, -- Use request status instead of upload status
    du.file_path,
    COALESCE(du.metadata, '{}'::jsonb) as metadata,
    -- Calculate relevance score based on text similarity
    (
      CASE WHEN dr.title ILIKE '%' || query_text || '%' THEN 3.0 ELSE 0.0 END +
      CASE WHEN dr.document_type ILIKE '%' || query_text || '%' THEN 2.5 ELSE 0.0 END +
      CASE WHEN s.company_name ILIKE '%' || query_text || '%' THEN 2.0 ELSE 0.0 END +
      CASE WHEN dr.description ILIKE '%' || query_text || '%' THEN 1.5 ELSE 0.0 END +
      CASE WHEN dr.category ILIKE '%' || query_text || '%' THEN 1.0 ELSE 0.0 END
    )::NUMERIC as relevance_score
  FROM document_uploads du
  JOIN document_requests dr ON du.request_id = dr.id
  LEFT JOIN suppliers s ON dr.supplier_id = s.id
  WHERE 
    (
      (user_company_type = 'buyer' AND dr.buyer_id = user_company_id) OR
      (user_company_type = 'supplier' AND dr.supplier_id = user_company_id)
    )
    AND du.file_path IS NOT NULL
    AND (
      -- Only include documents that have some relevance to the query
      query_text = '' OR query_text IS NULL OR
      dr.title ILIKE '%' || query_text || '%' OR
      dr.document_type ILIKE '%' || query_text || '%' OR
      s.company_name ILIKE '%' || query_text || '%' OR
      dr.description ILIKE '%' || query_text || '%' OR
      dr.category ILIKE '%' || query_text || '%'
    )
  ORDER BY relevance_score DESC, dr.created_at DESC
  LIMIT match_limit;
END;
$$;