import { NextRequest, NextResponse } from "next/server";
import { getTenantContext } from "@/lib/business/dashboard";
import { canUse } from "@/lib/constants/plans";
import { isCompanyReviewed } from "@/lib/business/scoutGate";
import { loadCompanyCandidates } from "@/lib/business/candidates/load";
import { getCandidateProfileForCompany } from "@/lib/business/candidates/profile";
import { isCandidateNotesEnabled } from "@/lib/candidateNotes/server";
import { companyDisplayName } from "@/lib/companies/displayName";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSelectionHistory } from "@/lib/business/selectionHistory";

export const dynamic = "force-dynamic";

/**
 * ★候補者検索の右のプレビュー（2026-10-10 / 候補者探し 段1）。候補者1人ぶん。
 *
 * ⚠️★見せてよいかは**一覧と同じ関数**（`loadCompanyCandidates` を1人に絞って呼ぶ）。
 *    一覧に出ない人（can_send_scout が false・転職意欲が未設定など）は 404。ここで条件を組み立てない。
 * ⚠️ ゲートは /biz/candidates のページと同じ（審査済み・プランが引ける・candidateSearch が使える）。
 * ⚠️ 自己紹介・経歴・スキルは `getCandidateProfileForCompany`（「声かけを書く」と同じ関数。社名を伏せた職歴は出さない）。
 */
export async function GET(_req: NextRequest, { params }: { params: { userId: string } }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isCompanyReviewed(ctx) || ctx.planType === null || !canUse(ctx.planType, "candidateSearch")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const loaded = await loadCompanyCandidates({
    companyId: ctx.tenantId, viewerOwUserId: ctx.currentOwnId, planType: ctx.planType, onlyOwUserId: params.userId,
  });
  const candidate = loaded.candidates.find((c) => c.id === params.userId);
  if (!candidate) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [profile, { data: co, error: coErr }, history] = await Promise.all([
    getCandidateProfileForCompany(params.userId),
    /* ★「〈会社名〉と合うところ」の会社名（2026-10-11）。短い表示名（株式会社などを外す）。取れなければ null */
    createAdminClient().from("ow_companies").select("name, name_en").eq("id", ctx.tenantId).maybeSingle(),
    /* ★この会社との接点（2026-10-12）。選考管理の「この会社とのこれまで」と同じ関数。自社のものだけ */
    getSelectionHistory(ctx.tenantId, params.userId),
  ]);
  if (coErr) console.error("[candidates/preview] company:", coErr.message);
  if (!profile) return NextResponse.json({ error: "取得できませんでした" }, { status: 500 });

  return NextResponse.json({
    candidate,
    aboutMe: profile.aboutMe,
    experiences: profile.experiences,
    skills: profile.skills,
    touchpointMaterials: loaded.touchpointMaterials,
    approachJobs: loaded.approachJobs,
    companyShortName: co ? companyDisplayName(co.name as string, (co.name_en as string | null) ?? null).displayName : null,
    /* ★社内メモの欄を出すか。⚠️ フラグがオフなら出さない（API も 404） */
    notesEnabled: isCandidateNotesEnabled(),
    /* ★最新1件＋ほかの件数。⚠️ 送ったメッセージと返信は右欄の下のメッセージ欄に出すので、ここでは数えない（二重にしない）。
          取れなければ null（行を出さない） */
    contacts: (() => {
      if (!history) return null;
      const rows = history.filter((h) => h.kind !== "approach_sent" && h.kind !== "approach_reply");
      if (rows.length === 0) return null;
      return { latest: { at: rows[0].at, title: rows[0].title }, more: rows.length - 1 };
    })(),
  });
}
