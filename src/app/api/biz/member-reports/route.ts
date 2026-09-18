import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCompanyContext } from "@/lib/business/company";
import { requireAdmin, permissionDeniedResponse } from "@/lib/auth/permissions";
import { VALID_MEMBER_REPORT_REASONS, MEMBER_REPORT_NOTE_MAX, memberReportReasonLabel } from "@/lib/constants/memberReports";
import { sendEmail } from "@/lib/notify/email";
import { memberReportAdminTemplate } from "@/lib/notify/templates";

export const dynamic = "force-dynamic";

/**
 * POST /api/biz/member-reports — 「この人は在籍していない」と運営に報告する
 *
 * ⚠️★**ここで人が消えるわけではない。** 記録するだけで、企業ページから外すかどうかは
 *    運営が `/admin/member-reports` で判断する（外す操作の実体は
 *    `ow_company_hidden_experiences`。**企業からは書けない**）。
 *    2026-09-18 まではここが直接「非表示」にする API だった。
 *
 * ⚠️ `ow_company_member_reports` は運営専用（RLS 有効・ポリシー0本・GRANT なし）なので、
 *    書き込みは `createAdminClient` から行う。**その代わり、自社の経歴かどうかを
 *    このルートで必ず検証する**（RLS が守ってくれない）。
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cookieCompanyId = cookies().get("biz_current_company_id")?.value;
  const ctx = await getCompanyContext(supabase, user.id, cookieCompanyId);
  if (!ctx) return NextResponse.json({ error: "Company context not found" }, { status: 404 });

  try { requireAdmin(ctx.allMemberships, ctx.companyId); } catch { return permissionDeniedResponse(); }

  let body: { experience_id?: unknown; reason?: unknown; note?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "INVALID_JSON", message: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const experienceId = typeof body.experience_id === "string" ? body.experience_id : "";
  if (!experienceId) {
    return NextResponse.json({ error: "MISSING_EXPERIENCE_ID", message: "対象が指定されていません。" }, { status: 400 });
  }

  /* ⚠️★許容リストを書き写さない（`memberReports.ts` から導出）。
        DB にも同じ集合の CHECK があるが、ここで弾かないと 23514 が 500 に化ける。 */
  const reason = typeof body.reason === "string" ? body.reason : "";
  if (!VALID_MEMBER_REPORT_REASONS.has(reason)) {
    return NextResponse.json({ error: "INVALID_REASON", message: "報告の種類が不正です。" }, { status: 400 });
  }

  /* 補足は任意。⚠️ 空文字は null にする（「空で送った」と「送っていない」を同じに扱う）。 */
  const rawNote = typeof body.note === "string" ? body.note.trim() : "";
  if (rawNote.length > MEMBER_REPORT_NOTE_MAX) {
    return NextResponse.json(
      { error: "NOTE_TOO_LONG", message: `補足は${MEMBER_REPORT_NOTE_MAX}文字以内で入力してください。` },
      { status: 400 },
    );
  }
  const note = rawNote === "" ? null : rawNote;

  const admin = createAdminClient();

  /* ★最重要: その経歴が自社のものか。**URL の値をそのまま信じない。**
     ⚠️ 他社の経歴を報告できると、運営の作業キューを他社の人で埋められる。 */
  const { data: exp, error: expErr } = await admin
    .from("ow_experiences")
    .select("id, company_id")
    .eq("id", experienceId)
    .maybeSingle();
  if (expErr) {
    console.error("[POST /api/biz/member-reports] experience:", expErr.message);
    return NextResponse.json({ error: "LOOKUP_FAILED", message: "対象を確認できませんでした。" }, { status: 500 });
  }
  if (!exp) return NextResponse.json({ error: "NOT_FOUND", message: "対象が見つかりません。" }, { status: 404 });
  if (exp.company_id !== ctx.companyId) {
    return NextResponse.json({ error: "FORBIDDEN", message: "この経歴は自社に属していません。" }, { status: 403 });
  }

  /* 報告した担当者（`ow_company_admins.id`）。⚠️ 取れなくても報告は残す。 */
  const { data: adminRecord } = await admin
    .from("ow_company_admins")
    .select("id")
    .eq("user_id", ctx.owUserId)
    .eq("company_id", ctx.companyId)
    .eq("is_active", true)
    .maybeSingle();

  const { error } = await admin
    .from("ow_company_member_reports")
    .insert({
      company_id: ctx.companyId,
      experience_id: experienceId,
      reason,
      note,
      reported_by: adminRecord?.id ?? null,
    });

  /* ⚠️ 23505 は UNIQUE (company_id, experience_id)。**同じ経歴の2回目は正常**として扱う
        （企業から見れば「もう報告済み」で、押し直しても壊れない）。 */
  if (error && error.code !== "23505") {
    console.error("[POST /api/biz/member-reports] insert:", error.message);
    return NextResponse.json({ error: "SAVE_FAILED", message: "報告を記録できませんでした。" }, { status: 500 });
  }
  const alreadyReported = error?.code === "23505";

  /* ★運営への通知（2026-09-18 / C-7）。**best-effort**。
     ⚠️★**INSERT のあとに置く。** メールが飛ばないせいで報告が失われない形にする。
        失敗は握り潰さずログに出す（`sendEmail` は Resend の error も console に出す）。
     ⚠️ 既に未対応の報告がある（23505）ときは送らない。**同じ報告で何通も飛ばさない。**
        却下後の再報告は新しい行になるので、そのときは送られる。
     ⚠️ 新しい送信経路を作らない。`newCompanyAdminTemplate` と同じ形。 */
  if (!alreadyReported) {
    try {
      /* ⚠️ 氏名は取れないことがある（経歴が消えた等）。**既定値で埋めない** */
      const { data: person } = await admin
        .from("ow_experiences")
        .select("ow_users!user_id(name)")
        .eq("id", experienceId)
        .maybeSingle();
      const { data: company } = await admin
        .from("ow_companies")
        .select("name")
        .eq("id", ctx.companyId)
        .maybeSingle();

      await sendEmail(
        memberReportAdminTemplate({
          companyName: (company?.name as string | null) ?? "（企業名不明）",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          personName: ((person as any)?.ow_users?.name as string | null) ?? null,
          reasonLabel: memberReportReasonLabel(reason),
          note,
          reportedAt: new Date().toISOString(),
        }),
      );
    } catch (err) {
      console.error("[POST /api/biz/member-reports] admin notify failed:", err);
    }
  }

  return NextResponse.json({ ok: true, alreadyReported });
}
