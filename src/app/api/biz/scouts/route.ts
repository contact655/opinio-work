import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// GET: list scouts sent by this company
export async function GET(_req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: scouts, error } = await admin
    .from("ow_scouts")
    .select("id, status, sent_at, replied_at, conversation_id, message, candidate_id, ow_jobs(id, title)")
    .eq("company_id", ctx.tenantId)
    .order("sent_at", { ascending: false });

  if (error) {
    console.error("[GET /api/biz/scouts]", error);
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }

  if (!scouts?.length) return NextResponse.json({ scouts: [] });

  // Resolve candidate ow_users info via auth_id
  const authIds = Array.from(new Set(scouts.map((s) => s.candidate_id).filter(Boolean)));
  const { data: users } = await admin
    .from("ow_users")
    .select("id, auth_id, name, avatar_color")
    .in("auth_id", authIds);

  const userMap = new Map((users ?? []).map((u) => [u.auth_id, u]));
  const result = scouts.map((s) => ({
    ...s,
    candidate: userMap.get(s.candidate_id) ?? null,
  }));

  return NextResponse.json({ scouts: result });
}

// POST: send a scout to a candidate
export async function POST(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!ctx.isPublished) {
    return NextResponse.json(
      { error: "運営審査が完了するまでスカウトを送信できません" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { candidate_id, message, job_id } = body as {
    candidate_id?: string;
    message?: string;
    job_id?: string | null;
  };

  if (!candidate_id || typeof candidate_id !== "string") {
    return NextResponse.json({ error: "candidate_id required" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "メッセージは2000文字以内で入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();

  // candidate_id は ow_users.id。ow_scouts は auth.users.id を参照する場合もあるため
  // ow_users.auth_id を取得して candidate を特定
  const { data: candidateUser } = await admin
    .from("ow_users")
    .select("id, auth_id")
    .eq("id", candidate_id)
    .maybeSingle();

  if (!candidateUser) {
    return NextResponse.json({ error: "candidate not found" }, { status: 404 });
  }

  // ow_scouts INSERT — trigger が自動でバリデーション + 枠消費
  const { error } = await admin.from("ow_scouts").insert({
    company_id: ctx.tenantId,
    candidate_id: candidateUser.auth_id ?? candidate_id,
    job_id: job_id ?? null,
    message: message.trim(),
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  if (error) {
    // トリガーからのエラーコードで判定
    const code = (error as any).code as string ?? "";
    const msg = (error as any).message as string ?? "";
    if (code === "P0001" || msg.includes("P0001") || msg.includes("スカウトを送信できません")) {
      return NextResponse.json({ error_code: "P0001", error: "この候補者にはスカウトを送信できません" }, { status: 422 });
    }
    if (code === "P0002" || msg.includes("P0002") || msg.includes("送信枠")) {
      return NextResponse.json({ error_code: "P0002", error: "今月のスカウト送信枠を使い切りました。追加をご希望の場合はお問い合わせください" }, { status: 422 });
    }
    console.error("[POST /api/biz/scouts]", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
