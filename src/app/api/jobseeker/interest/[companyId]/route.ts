import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkInterestEligibility, expressInterest } from "@/lib/interest/server";

export const dynamic = "force-dynamic";

/**
 * ★企業ページの「話を聞いてみたい」（2026-10-27 / 話を聞きたい人 フェーズ1a）。
 *   GET  … 押せるか・いまの状態（ボタンを出すか決める）。押せない理由は返さない
 *   POST … 押す（記録して届ける。lib/interest/server.ts の expressInterest。合う会社・提案と同じ）
 * ⚠️★担当者がいない会社では hasResponder=false を返し、画面はボタンを出さない（企業ページの「保存」だけが残る）。
 *    その会社が OPINIO にいないことが分かる文言は返さない・出さない（2026-10-27 / 柴さんの決定）。
 * ⚠️ 書くのは admin クライアント（ow_for_you_reactions はクライアントに書き込みを配っていない）。本人の行だけ書く。
 * ⚠️ 企業ページは ISR。閲覧者ごとの中身はこの API から取り、ページ本体には混ぜない。
 */
async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await createAdminClient().from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) console.error("[jobseeker/interest] ow_users:", error.message);
  return (data?.id as string | undefined) ?? null;
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(_req: NextRequest, { params }: { params: { companyId: string } }) {
  const owUserId = await me();
  if (!owUserId) return NextResponse.json({ eligible: false, authenticated: false }, { headers: NO_STORE });
  const db = createAdminClient();
  const [elig, { data: row, error }] = await Promise.all([
    checkInterestEligibility(owUserId, params.companyId, db),
    db.from("ow_for_you_reactions").select("interested_at, interest_status, conversation_id")
      .eq("user_id", owUserId).eq("company_id", params.companyId).maybeSingle(),
  ]);
  if (error) console.error("[jobseeker/interest] 記録:", error.message);
  /* ⚠️「押した」は届いた（会話がある）ものだけ */
  const pressed = !!row?.interested_at && !!row?.conversation_id;
  return NextResponse.json({
    authenticated: true,
    eligible: elig.ok,
    companyName: elig.ok ? elig.companyName : null,
    hasResponder: elig.ok ? elig.hasResponder : false,
    pressed,
    status: pressed ? (row?.interest_status ?? null) : null,
    conversationId: pressed ? ((row?.conversation_id as string | null) ?? null) : null,
  }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: { params: { companyId: string } }) {
  const owUserId = await me();
  if (!owUserId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const out = await expressInterest({
    owUserId, companyId: params.companyId, source: "company_page",
    note: body.note, consentVersion: body.consentVersion,
  });
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
  return NextResponse.json({ ok: true, status: out.status, conversationId: out.conversationId });
}
