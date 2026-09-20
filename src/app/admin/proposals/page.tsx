import { createAdminClient } from "@/lib/supabase/admin";
import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";
import { proposalStage } from "@/lib/constants/proposalResponses";
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
  /* ★★ここを消さないこと。消すと上の漏れに戻る。
        判定は `lib/auth/adminPageGuard.ts` に集約した（/admin の5ページと共有）。 */
  if (!(await viewerIsAdmin())) return null; // 画面はレイアウトの「権限がありません」が出す

  const db = createAdminClient();

  /* 候補者の一覧。★`isRegisteredUser` を通す（本人が登録していない行を出さない） */
  const { data: users, error: uErr } = await db
    .from("ow_users")
    .select("id, name, auth_id, is_test, is_system, visibility")
    .neq("visibility", "private")
    .order("name");
  if (uErr) console.error("[admin/proposals] ow_users:", uErr.message);

  /* ★本人が企業からの連絡を受け取る設定か（2026-09-21）。
        ⚠️ `ow_profiles.user_id` は **auth 空間**。`ow_users.id` では引けない。
        ⚠️ 受け取らない人を**一覧から消さない**。消すと運営が
           「なぜこの人が居ないのか」を追えない（黙って消さない）。ラベルで示す。 */
  const authIds = (users ?? []).map((u) => u.auth_id as string | null).filter(Boolean) as string[];
  const { data: profs, error: prErr } = authIds.length
    ? await db.from("ow_profiles").select("user_id, career_stance").in("user_id", authIds)
    : { data: [], error: null };
  if (prErr) console.error("[admin/proposals] ow_profiles:", prErr.message);
  const stanceByAuthId = new Map(
    (profs ?? []).map((p) => [p.user_id as string, (p.career_stance as string | null) ?? null]),
  );

  const candidates = (users ?? [])
    .filter((u) => isRegisteredUser(u) && u.is_system !== true)
    .map((u) => ({
      id: u.id as string,
      name: (u.name as string) ?? "—",
      /* ⚠️ `is_test` を**隠さない。ラベルを付けて区別だけ示す**
            （`/admin/ambassador-requests` と同じ方針。検証で使うので消さない） */
      isTest: u.is_test === true,
      stance: stanceByAuthId.get(u.auth_id as string) ?? null,
    }));

  const { data: proposals, error: pErr } = await db
    .from("ow_proposals")
    .select("id, candidate_user_id, company_id, job_id, evidence, counter_evidence, computed_at, candidate_response, company_response, introduced_at, ow_companies(name)")
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
    /* ★段は2つの返答から導出する。列で持たない（CLAUDE.md） */
    stage: proposalStage(
      (p.candidate_response as string | null) ?? null,
      (p.company_response as string | null) ?? null,
    ),
    /* ⚠️ 「紹介したか」の正は `introduced_at`（`conversation_id` は消えうる） */
    introduced: p.introduced_at != null,
  }));

  return (
    <ProposalsAdminClient
      candidates={candidates}
      rows={rows}
      minEvidence={MIN_EVIDENCE_FOR_PROPOSAL}
    />
  );
}
