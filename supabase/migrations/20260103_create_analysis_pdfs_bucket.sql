-- Create Storage Bucket for Analysis PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'analysis-pdfs',
    'analysis-pdfs',
    false, -- Private bucket, requires authentication
    20971520, -- 20MB limit
    ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for analysis-pdfs bucket

-- Policy: Users can upload PDFs to their own folder
CREATE POLICY "Users can upload their own PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'analysis-pdfs' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own PDFs
CREATE POLICY "Users can read their own PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'analysis-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own PDFs
CREATE POLICY "Users can update their own PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'analysis-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own PDFs
CREATE POLICY "Users can delete their own PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'analysis-pdfs'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
