-- Create the missing search_knowledge_entries function
CREATE OR REPLACE FUNCTION public.search_knowledge_entries(
  query_embedding text,
  company_id_param uuid,
  company_type_param text,
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  title text,
  content text,
  entry_type text,
  metadata jsonb,
  source_reference text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ake.id,
    ake.title,
    ake.content,
    ake.entry_type,
    ake.metadata,
    ake.source_reference,
    (1 - (ake.embedding <-> query_embedding::vector))::float as similarity
  FROM ai_knowledge_entries ake
  WHERE ake.company_id = company_id_param
    AND ake.company_type = company_type_param
    AND (ake.expires_at IS NULL OR ake.expires_at > now())
    AND (1 - (ake.embedding <-> query_embedding::vector)) >= similarity_threshold
  ORDER BY ake.embedding <-> query_embedding::vector
  LIMIT match_count;
END;
$$;