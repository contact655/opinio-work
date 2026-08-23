import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
import { MEMBER_CREATED_VIA, memberState } from "@/lib/constants/companyMembers";
import { sendEmail } from "@/lib/notify/email";
import { ambassadorApprovedTemplate, ambassadorDismissedTemplate } from "@/lib/notify/templates";

/**
 * 面談対応者の「承認」と「見送り」を**書き込みごと**引き受ける（2026-08-23）。
 *
 * ── なぜ書き込みまで中に入れるか ────────────────────────────────────────────
 * 承認は3経路、見送りは2経路ある。判定と送信だけを共通関数にして
 * 「各経路から呼ぶ」形にすると、**新しい経路を足した人が呼び忘れる**。
 * `revalidateCompanyAmbassadors` が実際にその形で、7経路すべてで呼ぶ約束に
 * なっている（＝約束を守らせる仕組みが無い）。
 *
 * → **UPDATE / DELETE をこの関数の内側に置く。** 呼び出し側は状態を書き換える
 *   手段をここ以外に持たないので、通知とキャッシュ破棄だけを落とすことができない。
 *
 * ⚠️ 新しく `is_public` を true にする経路や、行を消す経路を足すときは、
 *    ここに関数を足すか既存の関数を呼ぶこと。**ルートに直接 UPDATE を書かない。**
 *
 * ── 通知を送る条件 ──────────────────────────────────────────────────────────
 * | 遷移                          | 通知 |
 * |-------------------------------|------|
 * | pending_company → listed（初回） | 送る |
 * | unlisted → listed（再掲載）      | 送らない |
 * | pending_company の行を削除        | 送る |
 * | listed / unlisted の行を削除      | 送らない（「掲載の取り消し」は別の事象。積み残し） |
 * | pending_user の行を削除           | 送らない（本人は何も申し込んでいない） |
 *
 * ⚠️ 「is_public が true になったら送る」にしないこと。企業が公開⇄非公開を
 *    往復させるたびにメールが飛ぶ。**初回だけ**を `approved_at is null` で見分ける。
 */

export type DecisionResult =
  | { ok: true; notified: boolean }
  | { ok: false; error: string };

/** 通知に要る宛先。取れなければ送らない（本来の処理は止めない） */
async function loadNotifyTarget(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  companyId: string,
): Promise<{ email: string; userName: string; companyName: string } | null> {
  const [{ data: user, error: userErr }, { data: company, error: companyErr }] = await Promise.all([
    admin.from("ow_users").select("name, email").eq("id", userId).maybeSingle(),
    admin.from("ow_companies").select("name, brand_name").eq("id", companyId).maybeSingle(),
  ]);

  /* ⚠️ 握り潰さない。宛先が引けないと通知が静かに0通になる。 */
  if (userErr) console.error("[member-decide] ow_users:", userErr.message);
  if (companyErr) console.error("[member-decide] ow_companies:", companyErr.message);

  const email = (user?.email ?? "").trim();
  if (!email.includes("@")) {
    console.error(`[member-decide] メールアドレスが無いので送れない user=${userId}`);
    return null;
  }
  return {
    email,
    userName: user?.name ?? "",
    companyName: company?.brand_name ?? company?.name ?? "",
  };
}

/**
 * 送信は best-effort。**失敗しても承認・見送りは成功させる。**
 * ⚠️ ただし必ずログに出す（CLAUDE.md「エラーと失敗を握りつぶさない」）。
 */
async function notifyDecision(
  admin: ReturnType<typeof createAdminClient>,
  kind: "approved" | "dismissed",
  userId: string,
  companyId: string,
): Promise<boolean> {
  try {
    const target = await loadNotifyTarget(admin, userId, companyId);
    if (!target) return false;
    const tpl =
      kind === "approved"
        ? ambassadorApprovedTemplate({ to: target.email, userName: target.userName, companyName: target.companyName })
        : ambassadorDismissedTemplate({ to: target.email, userName: target.userName, companyName: target.companyName });
    await sendEmail(tpl);
    return true;
  } catch (e) {
    console.error(`[member-decide] ${kind} の通知に失敗（処理は続行）:`, e);
    return false;
  }
}

/**
 * 承認する（`is_public` → true）。
 *
 * ⚠️ 初回承認かどうかは**条件付き UPDATE で原子的に**判定する。
 *    読んでから書くと、2人の担当者が同時に押したときに二重送信になる。
 *
 * @param scopeCompanyId 渡すと「その企業の行であること」を WHERE に足す（多重の所属確認）
 */
export async function approveMember(
  memberId: string,
  scopeCompanyId?: string,
): Promise<DecisionResult> {
  const admin = createAdminClient();

  /* ── ① 初回承認だけに当たる UPDATE ────────────────────────────────────
     `approved_at is null` と `created_via='self'` で、
     「本人が申請し、まだ一度も承認されていない行」だけに絞る。
     1行返れば初回承認。0行なら再掲載か、そもそも別の状態。 */
  let first = admin
    .from("ow_company_members")
    .update({ is_public: true, approved_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("is_public", false)
    .eq("display_consent", true)
    .eq("created_via", MEMBER_CREATED_VIA.SELF)
    .is("approved_at", null);
  if (scopeCompanyId) first = first.eq("company_id", scopeCompanyId);

  /* ⚠️ 引数なしの `.select()` を呼ばない。全列を返すため、列単位 GRANT を
        剥がした列があると 403 になる（CLAUDE.md）。 */
  const { data: firstRows, error: firstErr } = await first.select("id, user_id, company_id");
  if (firstErr) {
    console.error("[member-decide] approve(初回):", firstErr.message);
    return { ok: false, error: firstErr.message };
  }

  if (firstRows && firstRows.length > 0) {
    const row = firstRows[0] as { user_id: string; company_id: string };
    const notified = await notifyDecision(admin, "approved", row.user_id, row.company_id);
    revalidateCompanyAmbassadors(row.company_id);
    return { ok: true, notified };
  }

  /* ── ② 初回でなかった → 通常の公開（再掲載など）。通知は送らない ────── */
  let again = admin
    .from("ow_company_members")
    .update({ is_public: true })
    .eq("id", memberId);
  if (scopeCompanyId) again = again.eq("company_id", scopeCompanyId);

  const { data: rows, error } = await again.select("id, company_id");
  if (error) {
    console.error("[member-decide] approve(再掲載):", error.message);
    return { ok: false, error: error.message };
  }
  /* ⚠️ 0行更新を成功として扱わない（CLAUDE.md）。 */
  if (!rows || rows.length === 0) {
    return { ok: false, error: "対象が見つかりませんでした（既に処理済みかもしれません）" };
  }

  revalidateCompanyAmbassadors((rows[0] as { company_id: string }).company_id);
  return { ok: true, notified: false };
}

/**
 * 非公開に戻す（`is_public` → false）。**通知は送らない。**
 *
 * ⚠️ `approved_at` は消さない。消すと次に公開したときが「初回承認」に見え、
 *    往復のたびに承認メールが飛ぶ（この列を足した理由そのもの）。
 */
export async function unlistMember(
  memberId: string,
  scopeCompanyId?: string,
): Promise<DecisionResult> {
  const admin = createAdminClient();
  let q = admin.from("ow_company_members").update({ is_public: false }).eq("id", memberId);
  if (scopeCompanyId) q = q.eq("company_id", scopeCompanyId);

  const { data: rows, error } = await q.select("id, company_id");
  if (error) {
    console.error("[member-decide] unlist:", error.message);
    return { ok: false, error: error.message };
  }
  if (!rows || rows.length === 0) {
    return { ok: false, error: "対象が見つかりませんでした" };
  }
  revalidateCompanyAmbassadors((rows[0] as { company_id: string }).company_id);
  return { ok: true, notified: false };
}

/**
 * 行を削除する（見送り / 解除 / 招待の取り消し）。
 *
 * ⚠️ **消える行の状態でしか、どの操作なのかを区別できない。**
 *    `/biz` の「見送る」「解除」「招待の取り消し」は同じ DELETE を通るため。
 *    だから DELETE の戻り行（＝消える直前の姿）から判定する。
 *
 * ⚠️ `delete(...).select(...)` は**消えた行そのもの**を返す。
 *    先に SELECT してから DELETE すると、その間に状態が変わりうる。
 */
export async function dismissMember(
  memberId: string,
  scopeCompanyId?: string,
): Promise<DecisionResult> {
  const admin = createAdminClient();
  let q = admin.from("ow_company_members").delete().eq("id", memberId);
  if (scopeCompanyId) q = q.eq("company_id", scopeCompanyId);

  const { data: rows, error } = await q.select(
    "id, user_id, company_id, display_consent, is_public, created_via, approved_at",
  );
  if (error) {
    console.error("[member-decide] dismiss:", error.message);
    return { ok: false, error: error.message };
  }
  if (!rows || rows.length === 0) {
    return { ok: false, error: "対象が見つかりませんでした" };
  }

  const row = rows[0] as {
    user_id: string; company_id: string;
    display_consent: boolean; is_public: boolean;
    created_via: string | null; approved_at: string | null;
  };

  /* ⚠️ 判定は `memberState()` に委ねる。ここで条件を書き直さない。 */
  const wasPendingCompany = memberState(row) === "pending_company";

  const notified = wasPendingCompany
    ? await notifyDecision(admin, "dismissed", row.user_id, row.company_id)
    : false;

  revalidateCompanyAmbassadors(row.company_id);
  return { ok: true, notified };
}
