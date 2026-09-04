import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 既存企業への「担当者に追加してください」という依頼の記録（2026-09-04）。
 *
 * ── なぜ足したか ────────────────────────────────────────────────────────────
 * **依頼はメールを送るだけで、どこにも残っていなかった。**
 * 送った本人が画面を開き直すと `/biz/companies/add` の
 * 「参加方法を選んでください」に戻るだけで、**依頼したという事実が消える。**
 * 承認されるまで何日かかるか分からないのに、待っているのか失敗したのかが
 * 本人から見えず、同じ操作を繰り返すことになっていた。
 *
 * ⚠️★**表は最初からあった**（`ow_company_join_requests` / baseline 由来）。
 *    ただし **src から読み書きが0件**で、本番も **0行**だった
 *    （CLAUDE.md「起こせなかった0」）。作ったのではなく、配線しただけ。
 *
 * ⚠️ **anon / authenticated に GRANT は無い**（RLS も有効・ポリシーは7本あるが
 *    GRANT が無いので効いていない）。**admin クライアントからのみ触ること。**
 *    ここを開けると、他人の依頼を読む経路を新しく作ることになる。
 *
 * ⚠️ **承認された瞬間に status を書き換える経路はまだ無い。**
 *    承認は既存の担当者が招待を送る形で行われ、この行は `pending` のまま残る。
 *    そのため**読む側で「もう担当者になっている企業」を必ず除く**
 *    （`fetchPendingJoinRequests`）。ここを省くと、承認済みの企業に対して
 *    「承認待ち」と出し続けることになる。
 */

type Client = SupabaseClient<any, any, any>;

export type PendingJoinRequest = {
  companyId: string;
  companyName: string;
  /** 最後に依頼を送った日時（再送すると更新される） */
  sentAt: string;
};

/**
 * 依頼を記録する。**best-effort**（失敗しても呼び出し側は止めない）。
 *
 * ⚠️ 依頼のメールは既に送られている。ここで失敗したときに 500 を返すと、
 *    「届いているのに失敗と表示される」ことになる。**記録だけを諦める。**
 * ⚠️ ただし黙らないこと。`console.error` は必ず出す
 *    （CLAUDE.md「Supabase の呼び出しで error を捨てない」）。
 */
export async function recordJoinRequest(
  admin: Client,
  { owUserId, companyId, approved }: { owUserId: string; companyId: string; approved: boolean },
): Promise<void> {
  const status = approved ? "approved" : "pending";

  /* ⚠️ (user_id, target_company_id) の一意制約は無いので、再送で行が増えないよう
        自分で見てから書く。**同時押しでの重複までは防げない**が、
        読む側は企業ごとに1件へ畳むので画面は壊れない。 */
  const { data: existing, error: selErr } = await admin
    .from("ow_company_join_requests")
    .select("id")
    .eq("user_id", owUserId)
    .eq("target_company_id", companyId)
    .eq("status", "pending")
    .maybeSingle();

  if (selErr) {
    console.error("[join-request] 既存の依頼を確認できませんでした:", selErr.message);
    return;
  }

  if (existing) {
    const { error } = await admin
      .from("ow_company_join_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select("id");
    if (error) console.error("[join-request] 依頼の更新に失敗:", error.message);
    return;
  }

  const { error } = await admin
    .from("ow_company_join_requests")
    .insert({
      user_id: owUserId,
      request_type: "join_existing",
      target_company_id: companyId,
      requested_permission: "admin",
      status,
    })
    .select("id");
  if (error) console.error("[join-request] 依頼の記録に失敗:", error.message);
}

/**
 * 自分が出した、まだ担当者になれていない依頼。
 *
 * ⚠️ **既に担当者になっている企業は除く。** 上の注記のとおり、承認されても
 *    この表の `status` は `pending` のまま残るため。
 */
export async function fetchPendingJoinRequests(
  admin: Client,
  owUserId: string,
): Promise<PendingJoinRequest[]> {
  const { data, error } = await admin
    .from("ow_company_join_requests")
    .select("target_company_id, updated_at, ow_companies!target_company_id(name)")
    .eq("user_id", owUserId)
    .eq("status", "pending")
    .eq("request_type", "join_existing")
    .order("updated_at", { ascending: false });

  if (error) {
    /* ⚠️ 失敗を「0件」に倒さない ——ただしここは画面の付加情報なので、
          出さないことで機能は壊れない。ログには必ず残す。 */
    console.error("[join-request] 依頼の取得に失敗:", error.message);
    return [];
  }

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: memberRows, error: memberErr } = await admin
    .from("ow_company_admins")
    .select("company_id")
    .eq("user_id", owUserId)
    .eq("is_active", true);

  if (memberErr) {
    /* ⚠️ 担当者かどうかが分からないまま「承認待ち」と出すと嘘になりうる。**出さない。** */
    console.error("[join-request] 所属の確認に失敗:", memberErr.message);
    return [];
  }
  const alreadyMember = new Set((memberRows ?? []).map((m) => m.company_id as string));

  const seen = new Set<string>();
  const out: PendingJoinRequest[] = [];
  for (const r of rows) {
    const companyId = r.target_company_id as string | null;
    if (!companyId || alreadyMember.has(companyId) || seen.has(companyId)) continue;
    const company = (r.ow_companies as unknown) as { name: string } | null;
    if (!company?.name) continue;   // 企業名を出せないなら書かない
    seen.add(companyId);
    out.push({ companyId, companyName: company.name, sentAt: r.updated_at as string });
  }
  return out;
}
