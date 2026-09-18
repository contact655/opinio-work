"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateProposalsForCandidate, type GenerateResult } from "@/lib/evidence/generate";

export type ActionResult =
  | { ok: true; result: GenerateResult }
  | { ok: false; error: string };

/**
 * 運営が候補者を1人指定して、提案をまとめて作る。
 *
 * ⚠️★**`/admin/layout.tsx` の `auth_is_admin()` ガードに頼り切らない。**
 *    Server Action は**画面を経由せず直接呼べる**ので、ここでも確かめる。
 *    （CLAUDE.md「認可の有無を、共通関数名の出現回数で判定しない」＝
 *      ルートごとに中身で守る、と同じ趣旨）
 */
export async function generateProposals(candidateOwUserId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("auth_is_admin");
  /* ⚠️ 握り潰さない。失敗を「管理者ではない」に倒すのは正しいが、
        **落ちていることに気づけない**のは別の問題（CLAUDE.md）。 */
  if (adminErr) console.error("[admin/proposals] auth_is_admin:", adminErr.message);
  if (!isAdmin) return { ok: false, error: "運営権限がありません" };

  if (!candidateOwUserId) return { ok: false, error: "候補者を選んでください" };

  try {
    const result = await generateProposalsForCandidate(candidateOwUserId);
    revalidatePath("/admin/proposals");
    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/proposals] generate:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * 提案を消す（スナップショットを作り直したいとき）。
 * ⚠️ 見送り理由（`ow_proposal_declines`）も FK の cascade で一緒に消える。
 *    **返答済みの提案を消すと、その返答も消える。** 画面で警告すること。
 */
export async function deleteProposalsForCandidate(candidateOwUserId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: isAdmin } = await supabase.rpc("auth_is_admin");
  if (!isAdmin) return { ok: false, error: "運営権限がありません" };

  const db = createAdminClient();
  /* ⚠️ 0行でも正常（元から無いことがある）。`mutateAllowNone` と同じ扱い。
        ⚠️ ただし error は必ず見る。 */
  const { data, error } = await db
    .from("ow_proposals")
    .delete()
    .eq("candidate_user_id", candidateOwUserId)
    .select("id");
  if (error) {
    console.error("[admin/proposals] delete:", error.message);
    return { ok: false, error: error.message };
  }
  revalidatePath("/admin/proposals");
  return {
    ok: true,
    result: { examined: 0, proposable: 0, created: 0, skipped: (data ?? []).length, belowThreshold: 0 },
  };
}
