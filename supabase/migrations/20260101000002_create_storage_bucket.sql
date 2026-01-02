-- Create storage bucket for PDF uploads
-- This allows us to store PDFs separately and pass only URL to queue
-- Reducing queue message size from ~7MB to ~1KB (99.9% reduction)

insert into storage.buckets (id, name, public)
values ('analysis-pdfs', 'analysis-pdfs', false);

-- RLS Policies for analysis-pdfs bucket

-- Allow authenticated users to upload their own PDFs
create policy "Users can upload their own PDFs"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'analysis-pdfs' 
    and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own PDFs
create policy "Users can read their own PDFs"
on storage.objects for select
to authenticated
using (
    bucket_id = 'analysis-pdfs'
    and auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow service role to read all PDFs (for queue-processor)
create policy "Service role can read all PDFs"
on storage.objects for select
to service_role
using (bucket_id = 'analysis-pdfs');

-- Allow service role to delete PDFs (cleanup after processing)
create policy "Service role can delete PDFs"
on storage.objects for delete
to service_role
using (bucket_id = 'analysis-pdfs');

-- Comment for documentation
comment on table storage.buckets is 'Storage buckets for file uploads';
comment on policy "Users can upload their own PDFs" on storage.objects is 'Users can only upload to their own folder (user_id/)';
