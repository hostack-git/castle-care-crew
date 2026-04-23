
-- Switch the two public buckets to private — we'll generate signed URLs / use public URLs intentionally
UPDATE storage.buckets SET public = false WHERE id IN ('adventures','avatars');

-- Drop the broad public read policies that allowed listing
DROP POLICY IF EXISTS "Public read adventures bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;

-- Replace with authenticated-only read (no anonymous listing)
CREATE POLICY "Signed-in read adventures bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'adventures');

CREATE POLICY "Signed-in read avatars"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
