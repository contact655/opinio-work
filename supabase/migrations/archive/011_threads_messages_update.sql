-- Add missing columns to ow_threads
ALTER TABLE ow_threads ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE ow_threads ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE ow_threads ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Make sender_id nullable (system/company messages may not have a real user)
ALTER TABLE ow_messages ALTER COLUMN sender_id DROP NOT NULL;

-- Add INSERT policy for ow_messages (candidates can send messages)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_messages' AND policyname='users_insert_messages') THEN
    CREATE POLICY users_insert_messages ON ow_messages FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM ow_threads WHERE ow_threads.id = thread_id AND ow_threads.candidate_id = auth.uid()));
  END IF;
END $$;

-- Add UPDATE policy for ow_threads (candidates can update their threads)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ow_threads' AND policyname='users_update_threads') THEN
    CREATE POLICY users_update_threads ON ow_threads FOR UPDATE TO authenticated
      USING (candidate_id = auth.uid()) WITH CHECK (candidate_id = auth.uid());
  END IF;
END $$;

-- Enable Realtime for ow_messages
ALTER PUBLICATION supabase_realtime ADD TABLE ow_messages;
