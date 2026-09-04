"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mutateOne } from "@/lib/supabase/mutate";
import { sendEmail } from "@/lib/notify/email";
import { joinRequestApprovedTemplate } from "@/lib/notify/templates";
import { revalidatePath } from "next/cache";

export type ActionResult = { ok: boolean; error?: string };

async function requireAdminOwUserId(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) throw new Error("Forbidden");

  /* ⚠️ `reviewed_by` は **ow_users 空間**（FK は ow_users）。`auth.uid()` を入れないこと
        （CLAUDE.md「auth.uid() が返すのは auth.users.id で、ow_users.id とは別物」）。 */
  const { data: owUser, error } = await createAdminClient()
    .from("ow_users").select("id").eq("auth_id", user.id).maybeSingle();
  if (error) throw new Error(`運営ユーザーを解決できませんでした: ${error.message}`);
  if (!owUser) throw new Error("運営ユーザーの行がありません");
  return owUser.id as string;
}

/**
 * 運営が代理で承認し、企業の担当者に追加する（2026-09-04）。
 *
 * ⚠️★**これは「企業が承認した」ではない。** 掲載中79社のうち依頼メールが届くのは
 *    2社だけ（2026-09-04 実測）で、残り77社は企業側に気づける人がいない。
 *    その穴を運営が肩代わりする操作。**在籍を確認したことにはならない。**
 *
 * ⚠️ 押すと**その企業の管理画面をその人に渡す**ことになる。画面側で
 *    メールのドメインと企業サイトの一致を材料として出し、二段階の確認を挟んでいる。
 *    **自動化しないこと**（ドメイン一致は本人性の証明ではない）。
 */
export async function approveJoinRequest(requestId: string): Promise<ActionResult> {
  const reviewerId = await requireAdminOwUserId();
  const admin = createAdminClient();

  /* ⚠️ 画面から渡された企業・ユーザーを信じない。**サーバーで引き直す。** */
  const { data: req, error: reqErr } = await admin
    .from("ow_company_join_requests")
    .select("id, user_id, target_company_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (reqErr) return { ok: false, error: `依頼を読めませんでした: ${reqErr.message}` };
  if (!req) return { ok: false, error: "依頼が見つかりません" };
  if (req.status !== "pending") return { ok: false, error: `この依頼は既に「${req.status}」です` };
  const companyId = req.target_company_id as string | null;
  const userId = req.user_id as string;
  if (!companyId) return { ok: false, error: "対象企業がありません" };

  /* 既に担当者なら追加しない（冪等）。⚠️ 二重に追加すると企業の一覧に同じ人が並ぶ */
  const { data: existing, error: exErr } = await admin
    .from("ow_company_admins")
    .select("id, is_active")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .maybeSingle();
  if (exErr) return { ok: false, error: `所属を確認できませんでした: ${exErr.message}` };

  if (!existing) {
    /* ⚠️ `created_via` は **"admin"**（＝管理画面からの直接追加）。
          "join_request" は**自動承認**で作られた行の印なので、
          運営が判断して通した行と混ぜない（CHECK が許すのは
          invite / join_request / admin / migration の4つ）。 */
    const r = await mutateOne(
      admin.from("ow_company_admins").insert({
        company_id: companyId,
        user_id: userId,
        permission: "admin",
        is_active: true,
        created_via: "admin",
      }),
      "admin approveJoinRequest insert",
      { returning: "id" },
    );
    if (!r.ok) return { ok: false, error: r.error };
  } else if (existing.is_active !== true) {
    const r = await mutateOne(
      admin.from("ow_company_admins").update({ is_active: true }).eq("id", existing.id),
      "admin approveJoinRequest reactivate",
      { returning: "id" },
    );
    if (!r.ok) return { ok: false, error: r.error };
  }

  /* ⚠️ **担当者への追加が済んでから**依頼の状態を書く。順序を逆にすると、
        追加に失敗したのに承認済みとして残る（CLAUDE.md「入れ替え方式では順序も守る」）。 */
  const upd = await mutateOne(
    admin.from("ow_company_join_requests").update({
      status: "approved",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", requestId),
    "admin approveJoinRequest status",
    { returning: "id" },
  );
  if (!upd.ok) return { ok: false, error: upd.error };

  /* 本人に知らせる。**best-effort**（承認そのものは済んでいるので失敗で巻き戻さない）。
     ⚠️ 黙らない。届かなかったことはログに残す。 */
  const { data: user } = await admin.from("ow_users").select("name, email").eq("id", userId).maybeSingle();
  const { data: company } = await admin
    .from("ow_companies").select("name, brand_name").eq("id", companyId).maybeSingle();
  if (user?.email) {
    try {
      await sendEmail(joinRequestApprovedTemplate({
        to: user.email as string,
        requesterName: (user.name as string | null) ?? "ご担当者",
        companyName: (company?.brand_name as string | null) ?? (company?.name as string | null) ?? "貴社",
      }));
    } catch (e) {
      console.error("[admin/join-requests] 承認メールの送信に失敗:", e);
    }
  } else {
    console.error(`[admin/join-requests] 承認したがメールアドレスが無い user=${userId}`);
  }

  revalidatePath("/admin/company-join-requests");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * 見送る（`rejected` にする）。
 *
 * ⚠️ **本人には通知しない。** 理由を書けないため（面談対応者の見送りと違い、
 *    こちらは「あなたはその会社の人ではない」と告げることになる）。
 *    本人の画面からは依頼が消えるので、**もう一度送ることはできる。**
 * ⚠️ 行は消さない。`rejected` として残す（誰がいつ見送ったかを追えるようにする）。
 */
export async function rejectJoinRequest(requestId: string): Promise<ActionResult> {
  const reviewerId = await requireAdminOwUserId();
  const admin = createAdminClient();

  const r = await mutateOne(
    admin.from("ow_company_join_requests").update({
      status: "rejected",
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", requestId).eq("status", "pending"),
    "admin rejectJoinRequest",
    { returning: "id" },
  );
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath("/admin/company-join-requests");
  revalidatePath("/admin");
  return { ok: true };
}
