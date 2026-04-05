import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Temporary endpoint to create ow_threads and ow_messages tables
// Uses Supabase admin client to create records (tables must exist)
// If tables don't exist, provides SQL for manual execution

export async function GET() {
  const admin = createAdminClient();

  // Test if ow_threads exists
  const { error: threadsError } = await admin
    .from("ow_threads")
    .select("id")
    .limit(0);

  const { error: messagesError } = await admin
    .from("ow_messages")
    .select("id")
    .limit(0);

  const results: Record<string, string> = {};

  if (!threadsError) {
    results.ow_threads = "exists";
  } else {
    results.ow_threads = "missing - " + threadsError.message;
  }

  if (!messagesError) {
    results.ow_messages = "exists";
  } else {
    results.ow_messages = "missing - " + messagesError.message;
  }

  const needsMigration = threadsError || messagesError;

  return NextResponse.json({
    tables: results,
    needsMigration,
    sql: needsMigration
      ? `
-- Run this SQL in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS ow_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  status TEXT DEFAULT 'casual_requested',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, candidate_id)
);

ALTER TABLE ow_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_threads" ON ow_threads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "users_own_threads" ON ow_threads FOR SELECT TO authenticated USING (candidate_id = auth.uid());
CREATE POLICY "users_insert_threads" ON ow_threads FOR INSERT TO authenticated WITH CHECK (candidate_id = auth.uid());

CREATE TABLE IF NOT EXISTS ow_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  sender_type TEXT DEFAULT 'candidate',
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ow_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_messages" ON ow_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "thread_participants_read" ON ow_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM ow_threads WHERE ow_threads.id = thread_id AND ow_threads.candidate_id = auth.uid()));
`
      : null,
  });
}
