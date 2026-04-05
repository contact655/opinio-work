import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = createAdminClient();

    // Create ow_match_scores table
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        CREATE TABLE IF NOT EXISTS ow_match_scores (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          company_id UUID REFERENCES ow_companies(id) ON DELETE CASCADE,
          overall_score INTEGER DEFAULT 0,
          culture_score INTEGER DEFAULT 0,
          skill_score INTEGER DEFAULT 0,
          career_score INTEGER DEFAULT 0,
          workstyle_score INTEGER DEFAULT 0,
          match_reasons TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, company_id)
        );
        ALTER TABLE ow_match_scores ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS "ow_match_scores_own_read"
          ON ow_match_scores FOR SELECT
          USING (auth.uid() = user_id);
      `,
    });

    if (error) {
      // rpc might not exist, try raw fetch via management API
      return NextResponse.json({ error: error.message, hint: "Run the SQL in Supabase Dashboard SQL Editor: supabase/migrations/003_match_scores.sql" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
