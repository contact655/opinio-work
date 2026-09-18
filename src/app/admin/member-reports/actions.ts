"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { revalidatePath } from "next/cache";
import { revalidateCompanyPages } from "@/lib/companies/revalidate";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
import {
  VALID_MEMBER_REPORT_RESOLUTIONS,
  MEMBER_REPORT_RESOLUTION_NOTE_MAX,
  type MemberReportResolution,
} from "@/lib/constants/memberReports";

export type ActionResult = { ok: boolean; error?: string };

async function assertAdmin(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");
  return user.id;
}

/** `auth.users.id` → `ow_users.id`。⚠️ 空間が違う（`resolved_by` は ow_users 空間） */
async function resolveOwUserId(authUserId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("ow_users").select("id").eq("auth_id", authUserId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** 企業ページから外す / 戻す。⚠️ キャッシュを2つ捨てる */
async function applyHidden(companyId: string, experienceId: string, hidden: boolean): Promise<string | null> {
  const admin = createAdminClient();
  if (hidden) {
    const { error } = await admin
      .from("ow_company_hidden_experiences")
      .insert({ company_id: companyId, experience_id: experienceId });
    /* ⚠️ 23505 は「既に外してある」。押し直しても壊れない形にする。 */
    if (error && error.code !== "23505") {
      console.error("[admin/member-reports] hide:", error.message);
      return "非表示にできませんでした。";
    }
  } else {
    /* ⚠️ 0行でも正常（既に戻っている）。`mutateOne` を使わない。 */
    const { error } = await admin
      .from("ow_company_hidden_experiences")
      .delete()
      .eq("company_id", companyId)
      .eq("experience_id", experienceId);
    if (error) {
      console.error("[admin/member-reports] unhide:", error.message);
      return "表示に戻せませんでした。";
    }
  }

  await revalidateCompanyPages(companyId);
  /* ⚠️★**面談対応者のキャッシュも捨てる**（2026-09-18）。B7 で
        `getPublicAmbassadorsCached` が非表示を見るようになったので、
        呼ばないと「外したのに『話を聞ける人』には残る」が最大300秒続く。 */
  revalidateCompanyAmbassadors(companyId);
  return null;
}

/**
 * ★報告に結果を出す（2026-09-18 / C-9）。
 *
 * ⚠️★**「外す」と「対応済みにする」を1つにまとめてある。**
 *    2026-09-18 まで別々のボタンで、**「外したが未対応のまま」が事故で作れた**
 *    （運営が自分の作業状況を見失う）。未対応の行に出す操作はこれ1つだけにする。
 *    ⚠️ 意図して「外したまま未対応に戻す」ことはできる（`reopenReport` は
 *       非表示を解除しない）。**先に害を止めてから確認する**使い方のために残してある。
 *
 * ⚠️ `resolution` の許容値は定数から導出する（書き写さない。3層の規約）。
 * ⚠️★`resolution_note` は**企業の画面に出る**。運営メモではない。
 */
export async function resolveReport(
  reportId: string,
  companyId: string,
  experienceId: string,
  resolution: MemberReportResolution,
  note: string,
): Promise<ActionResult> {
  const authUserId = await assertAdmin();

  if (!VALID_MEMBER_REPORT_RESOLUTIONS.has(resolution)) {
    return { ok: false, error: "結果の値が不正です。" };
  }
  const trimmed = note.trim();
  if (trimmed.length > MEMBER_REPORT_RESOLUTION_NOTE_MAX) {
    return { ok: false, error: `理由は${MEMBER_REPORT_RESOLUTION_NOTE_MAX}文字以内で入力してください。` };
  }

  /* ★先に非表示を当てる。⚠️ 逆にすると「対応済みなのに外れていない」が残りうる
        （こちらの順なら、失敗しても未対応のまま＝キューに残るので気づける）。 */
  const hideError = await applyHidden(companyId, experienceId, resolution === "hidden");
  if (hideError) return { ok: false, error: hideError };

  const owUserId = await resolveOwUserId(authUserId);
  const r = await mutateOne(
    createAdminClient()
      .from("ow_company_member_reports")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: owUserId,
        resolution,
        /* ⚠️ 空文字は null に倒す（「空で送った」と「書かなかった」を同じに扱う） */
        resolution_note: trimmed === "" ? null : trimmed,
      })
      .eq("id", reportId),
    "member report resolve",
  );
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath("/admin/member-reports");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * 未対応に戻す（結果と理由を消す）。
 *
 * ⚠️★**非表示は解除しない。** 「先に外してから、未対応のキューに戻して確認を続ける」
 *    という使い方のため。⚠️ その状態は運営画面に**「外していますが、未対応のままです」**と出す
 *    （出さないと作業状況を見失う）。
 * ⚠️ 戻したいときは下の `setHidden` を使う。
 */
export async function reopenReport(reportId: string): Promise<ActionResult> {
  await assertAdmin();
  const r = await mutateOne(
    createAdminClient()
      .from("ow_company_member_reports")
      .update({ resolved_at: null, resolved_by: null, resolution: null, resolution_note: null })
      .eq("id", reportId),
    "member report reopen",
  );
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath("/admin/member-reports");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * 判断を後から直す（対応済みの行だけに出す）。
 * ⚠️ `resolution` も合わせて動かす。**表示と記録が食い違わないようにする。**
 */
export async function setHidden(
  reportId: string,
  companyId: string,
  experienceId: string,
  hidden: boolean,
): Promise<ActionResult> {
  await assertAdmin();
  const hideError = await applyHidden(companyId, experienceId, hidden);
  if (hideError) return { ok: false, error: hideError };

  /* ⚠️ 対応済みの行なら結果も揃える。未対応の行では `resolution` は NULL のままにする
        （DB の `CHECK ((resolved_at is null) = (resolution is null))` を破らない）。 */
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ow_company_member_reports")
    .select("resolved_at")
    .eq("id", reportId)
    .maybeSingle();
  if (row?.resolved_at) {
    const r = await mutateOne(
      admin
        .from("ow_company_member_reports")
        .update({ resolution: hidden ? "hidden" : "rejected" })
        .eq("id", reportId),
      "member report resolution 変更",
    );
    if (!r.ok) return { ok: false, error: r.error };
  }

  revalidatePath("/admin/member-reports");
  return { ok: true };
}
