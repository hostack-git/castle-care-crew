
UPDATE storage.buckets SET public = true WHERE id = 'adventures';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Public read adventures bucket') THEN
    CREATE POLICY "Public read adventures bucket" ON storage.objects
      FOR SELECT TO public USING (bucket_id = 'adventures');
  END IF;
END $$;
