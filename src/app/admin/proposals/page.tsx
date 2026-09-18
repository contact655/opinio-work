import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRegisteredUser } from "@/lib/users/registered";
import { MIN_EVIDENCE_FOR_PROPOSAL } from "@/lib/evidence/engine";
import ProposalsAdminClient from "./ProposalsAdminClient";

export const dynamic = "force-dynamic";

/**
 * 運営が提案を作る画面（②⑨の入口）。
 *
 * ⚠️★**`ow_proposals` に行を入れる経路はここだけ。**（`INSERT` は
 *    `authenticated` にも `anon` にも配っていない＝ service_role のみ）
 *    cron は作っていない。理由は `lib/evidence/generate.ts` の冒頭。
 *
 * ⚠️ 読み取りはサーバーコンポーネント + `createAdminClient`、
 *    書き込みは Server Action（CLAUDE.md「/admin 配下ではブラウザ側の
 *    Supabase クライアントを使わない」）。
 *
 * ── ★★`/admin/layout.tsx` のガードに頼らないこと（2026-09-18 に実際に漏らした）──
 * App Router では**レイアウトとページが並行して描画される**。レイアウトが
 * `children` を捨てて「権限がありません」を返しても、**ページ本体は実行され、
 * その props は RSC のフライトデータとして HTML の `<script>` に載る。**
 *
 * 実測（2026-09-18 / 運営権限の無い contact+NN のセッションで `/admin/proposals`）:
 *   画面 … 「権限がありません」（正しい）
 *   HTML … `{"id":"…","name":"木村雅樹","isTest":false}` が**実ユーザー8人ぶん**入っていた
 *
 * ⚠️★**したがってページの先頭でも `auth_is_admin()` を見る。**
 *    DB を引く前に返すこと（引いてから捨てても、遅い＋取得自体は起きる）。
 * ⚠️ 「画面に出していない」は根拠にならない。**サーバーから送らない**のが唯一の担保
 *    （⑨の匿名化と同じ考え方）。
 */
export default async function AdminProposalsPage() {
  /* ★★ここを消さないこと。消すと上の漏れに戻る。 */
  const { data: isAdmin } = await createClient().rpc("auth_is_admin");
  if (!isAdmin) return null; // 画面はレイアウトの「権限がありません」が出す

  const db = createAdminClient();

  /* 候補者の一覧。★`isRegisteredUser` を通す（本人が登録していない行を出さない） */
  const { data: users, error: uErr } = await db
    .from("ow_users")
    .select("id, name, auth_id, is_test, is_system, visibility")
    .neq("visibility", "private")
    .order("name");
  if (uErr) console.error("[admin/proposals] ow_users:", uErr.message);

  const candidates = (users ?? [])
    .filter((u) => isRegisteredUser(u) && u.is_system !== true)
    .map((u) => ({
      id: u.id as string,
      name: (u.name as string) ?? "—",
      /* ⚠️ `is_test` を**隠さない。ラベルを付けて区別だけ示す**
            （`/admin/ambassador-requests` と同じ方針。検証で使うので消さない） */
      isTest: u.is_test === true,
    }));

  const { data: proposals, error: pErr } = await db
    .from("ow_proposals")
    .select("id, candidate_user_id, company_id, job_id, evidence, counter_evidence, computed_at, candidate_response, company_response, ow_companies(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (pErr) console.error("[admin/proposals] ow_proposals:", pErr.message);

  const nameById = new Map(candidates.map((c) => [c.id, c.name]));
  const rows = (proposals ?? []).map((p) => ({
    id: p.id as string,
    candidateName: nameById.get(p.candidate_user_id as string) ?? "—",
    companyName:
      ((p.ow_companies as { name?: string } | null)?.name as string | undefined) ?? "—",
    evidenceCount: Array.isArray(p.evidence) ? p.evidence.length : 0,
    counterCount: Array.isArray(p.counter_evidence) ? p.counter_evidence.length : 0,
    hasJob: p.job_id != null,
    computedAt: (p.computed_at as string).slice(0, 10),
    candidateResponse: (p.candidate_response as string | null) ?? null,
    companyResponse: (p.company_response as string | null) ?? null,
  }));

  return (
    <ProposalsAdminClient
      candidates={candidates}
      rows={rows}
      minEvidence={MIN_EVIDENCE_FOR_PROPOSAL}
    />
  );
}
