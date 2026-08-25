import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateCompanyAmbassadors } from "@/lib/supabase/queries";
/* ⚠️ `memberState` は 2026-08-25 に使わなくなった。削除の通知は
      「本人が同意していたか」だけで決まるので、5状態に落とす必要が無い。 */
import { MEMBER_CREATED_VIA } from "@/lib/constants/companyMembers";
import { sendEmail } from "@/lib/notify/email";
import { ambassadorApprovedTemplate, ambassadorDismissedTemplate } from "@/lib/notify/templates";

/**
 * 面談対応者の「掲載」と「取り消し」を**書き込みごと**引き受ける（2026-08-23）。
 *
 * ★2026-08-24 に会社の事前承認を廃止した。ここに「承認」という操作はもう無い。
 *   企業ができるのは**掲載する / 非掲載にする / 登録を消す**の3つ。
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
 * | 遷移                                   | 通知 |
 * |----------------------------------------|------|
 * | 企業が**初めて**掲載した（approved_at が null） | 送る |
 * | 2回目以降の再掲載                          | 送らない |
 * | **本人が同意していた行**を削除            | **送る**（2026-08-25） |
 * | 同意していない行（招待に未応答）を削除     | 送らない |
 * | 非掲載にする（`unlistMember`）            | **送らない** |
 *
 * ⚠️ 削除だけ送るのは、**取り消せない**から。非掲載は本人のカードに理由が出るうえ、
 *    企業が往復させるたびにメールが飛ぶ。
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
 * 企業が掲載する（`is_public` → true）。
 *
 * ★2026-08-24 に `approveMember` から改名した。会社の事前承認を廃止したので、
 *   この関数は**承認ではなく「企業が掲載を（再）公開する」操作**になった。
 *   ⚠️ 名前を `approve` に戻さないこと。存在しないゲートがあるように読める。
 *
 * ⚠️ 「企業が初めて公開した」かどうかは**条件付き UPDATE で原子的に**判定する。
 *    読んでから書くと、2人の担当者が同時に押したときに二重送信になる。
 *
 * @param scopeCompanyId 渡すと「その企業の行であること」を WHERE に足す（多重の所属確認）
 */
export async function publishMember(
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
    "id, user_id, company_id, display_consent, is_public, created_via, approved_at, consent_at",
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
    /* ⚠️ 2026-08-24 追加。`memberState()` が必須で要求する（招待未応答と本人OFFの判別） */
    consent_at: string | null;
  };

  /* ★通知の条件を 2026-08-25 に変えた。
        旧: `pending_company`（会社の承認待ち）の行を消したときだけ送る
            → 会社の事前承認を廃止してその状態に**到達しなくなり、実質誰にも届かなくなっていた**。
        新: **本人が同意していた行**を消したときに送る。

     ⚠️★**削除は取り消せない。** 行が消えるので、戻すには本人が再申請して
        会社の確認をやり直すことになる。本人の画面には「無くなった」としか映らないので、
        伝えないと手がかりがゼロになる。
     ⚠️ **非掲載（`unlistMember`）では送らない。** 本人のカードに
        「会社の設定でいまは非掲載です」と出るし、企業が公開⇄非公開を往復させるたびに
        メールが飛ぶ（承認メールを「初回だけ」にしたのと同じ理由）。
     ⚠️ **同意していない行（招待に未応答）では送らない。** 本人は何も申し込んでいない。 */
  const wasConsented = row.display_consent === true;

  const notified = wasConsented
    ? await notifyDecision(admin, "dismissed", row.user_id, row.company_id)
    : false;

  revalidateCompanyAmbassadors(row.company_id);
  return { ok: true, notified };
}
