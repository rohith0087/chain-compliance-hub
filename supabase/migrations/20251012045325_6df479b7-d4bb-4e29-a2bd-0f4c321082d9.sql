-- Create exports storage bucket for CSV downloads
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy for exports bucket - users can upload exports
CREATE POLICY "Users can upload exports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exports');

-- RLS policy for exports bucket - public can download exports
CREATE POLICY "Public can download exports"
ON storage.objects FOR SELECT
USING (bucket_id = 'exports');

-- Optional: Add policy to allow deletion of old exports (30 days)
CREATE POLICY "Users can delete old exports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exports' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND created_at < NOW() - INTERVAL '30 days'
);