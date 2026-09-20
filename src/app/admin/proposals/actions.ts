"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateProposalsForCandidate, type GenerateResult } from "@/lib/evidence/generate";
import { mutateOne } from "@/lib/supabase/mutate";

/**
 * ⚠️★**削除の結果を「作成」の型に押し込まないこと**（2026-09-21 に直した）。
 *    それまで削除も `GenerateResult` を返しており、画面が
 *    **「作成しました。…新しく作った 0 件」**と出していた。
 *    **消したのに「作成しました」**は、画面が嘘をついている状態。
 */
export type ActionResult =
  | { ok: true; kind: "generate"; result: GenerateResult }
  | { ok: true; kind: "delete"; deleted: number }
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
    return { ok: true, kind: "generate", result };
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
  return { ok: true, kind: "delete", deleted: (data ?? []).length };
}

/**
 * ★提案を**1件だけ**消す（2026-09-21）。
 *
 * ── なぜ要るか ─────────────────────────────────────────────────────────────
 * **提案は1つの組み合わせにつき一度きり**（`ow_proposals_unique` ＋
 * `generate.ts` の `on conflict do nothing`）。一度でも出したら、見送られても
 * **その候補者 × その企業は二度と提案に出てこない。**
 * これは**意図した仕様**だが、運営が「この1件だけもう一度出したい」と思ったとき、
 * 2026-09-21 まで手段が `deleteProposalsForCandidate`（**候補者の提案を全部消す**）
 * しか無かった。⚠️★**あれは④の材料（見送り理由）まで cascade で消す。**
 *
 * ⚠️★**これを「再提案の仕組み」に育てないこと。** 理由ごと・期間ごとの
 *    出し分けは実データが無いと決められない（`known` で断った会社を N か月後に
 *    また出すのは明らかに違う）。**論点は docs に残してある。**
 *
 * ⚠️ この1件の見送り理由も一緒に消える（FK の cascade）。画面で警告すること。
 */
export async function deleteProposal(proposalId: string): Promise<ActionResult> {
  const supabase = createClient();
  const { data: isAdmin, error: adminErr } = await supabase.rpc("auth_is_admin");
  if (adminErr) console.error("[admin/proposals] auth_is_admin:", adminErr.message);
  if (!isAdmin) return { ok: false, error: "運営権限がありません" };

  if (!proposalId) return { ok: false, error: "提案が指定されていません" };

  const db = createAdminClient();
  /* ⚠️ `mutateOne`。**0行削除を成功として扱わない**（CLAUDE.md）。
        既に消えている／id が違うときにここで気づける。 */
  const r = await mutateOne(
    db.from("ow_proposals").delete().eq("id", proposalId),
    "admin proposal 1件削除",
  );
  if (!r.ok) return { ok: false, error: r.error };

  revalidatePath("/admin/proposals");
  return { ok: true, kind: "delete", deleted: 1 };
}
