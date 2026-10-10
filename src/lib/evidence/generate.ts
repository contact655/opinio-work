/**
 * 提案を作る経路（運営専用）。**ここが `ow_proposals` に行を入れる唯一の場所。**
 *
 * ⚠️★**cron にしない**（2026-09-18 の判断）。週次メールが停止中で
 *    （`vercel.json` の `crons` が空 ＋ `WEEKLY_EMAIL_ENABLED` 未設定）、
 *    配信の設計が別途要る。**作る頻度と届け方をまだ決めていないうちに
 *    自動で溜め始めない。**
 *
 * ⚠️★**再実行しても既存の提案は上書きしない**（`on conflict do nothing`）。
 *    `evidence` は**作成時点のスナップショット**で、作り直すと
 *    「候補者に見せた数字」と「後から見る数字」が食い違う。
 *    作り直したいときは運営が消してから実行する。
 *
 * ── ★★「提案は一度きり」は意図した仕様（2026-09-21 に確認）──────────────
 * `ow_proposals_unique (candidate_user_id, company_id, job_id)` と上の
 * `on conflict do nothing` の組み合わせで、**一度出した組み合わせは
 * 見送られても二度と提案に出てこない。**
 *
 * ⚠️★**期間や理由による自動の再提案は、意図して作っていない。**
 *    見送り理由には**時間で変わるもの**（`timing` / `salary` / `experience`）と
 *    **変わらないもの**（★`known`「すでに知っている」/ `location` / `job_content`）が
 *    混ざっているので、**一律に N か月後へ流すと `known` の会社をまた出す**ことになる。
 *    理由ごと・期間ごとの見切りは**実データが無いと決められない**
 *    （提案は 2026-09-21 時点で本番0件）。
 *
 * ⚠️ 運営の逃げ道は **`/admin/proposals` の「消す」（1件だけ）**。
 *    ⚠️ `deleteProposalsForCandidate`（候補者の提案を全部）は
 *       **④の材料（見送り理由）まで cascade で消す**ので、1件で済むときは使わない。
 *
 * ⚠️★**根拠が2件そろわず提案が作られなかった組み合わせは、行が無いので後から普通に
 *    作られる。** burn されるのは**一度出したぶんだけ**。混同しないこと。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { filterListedCompanies } from "@/lib/companies/visibility";
import {
  buildCounterEvidence,
  buildEvidence,
  isProposable,
  MIN_EVIDENCE_FOR_PROPOSAL,
} from "./engine";
import { companiesToExclude, evidenceOptions, gatherCompanyFacts } from "./fetch";
import { isReachableByCompanies } from "@/lib/constants/careerPreferences";
import { notifyProposalsCreated } from "@/lib/notify/proposalNotification";
import { isProposalEndedFor, isProposalExpired } from "./proposalEnded";

export type GenerateResult = {
  /** 掲載中で、候補者が在籍していない企業の数（＝突き合わせた母数） */
  examined: number;
  /** 根拠が2件以上そろった企業の数 */
  proposable: number;
  /** 実際に行を作った数（既にある提案は数えない） */
  created: number;
  /** 既に提案があってスキップした数 */
  skipped: number;
  /** ★根拠が2件未満で落ちた数。画面に出すこと（黙って消さない） */
  belowThreshold: number;
  /**
   * ★本人が企業からの連絡を受け取らない設定だったので、1件も作らなかった（2026-09-21）。
   * ⚠️ **黙って0件にしない。** 運営が「なぜこの人に提案が出ないのか」を追えるようにする。
   */
  blockedByStance?: { stance: string | null };
  /**
   * ★**`/biz` にログインできる人が1人もいないので外した企業の数**（2026-09-21）。
   * ⚠️ **黙って消さない。** 画面に出すこと。
   */
  withoutBizAccount: number;
  /**
   * ★**求職者が自分でブロックした企業など、`can_send_scout()` が「見せない」と返した企業の数**
   *   （2026-10-08）。判定に失敗した企業もここに数える（出す側に倒さない）。
   * ⚠️ **黙って消さない。** 画面に出すこと。
   */
  hiddenByCandidate: number;
  /**
   * ★**同じ候補者 × 企業に進行中の提案がある**ので作らなかった企業の数（2026-10-10 / 柴さんの決めごと）。
   *   進行中 ＝ 回答の締め切り（届いてから30日）前で、どちらから見ても終了していないもの。
   * ⚠️ 一意の決まり（候補者 × 企業 × 求人）は変えていない。求人が違えば行は作れてしまうので、ここで止める。
   */
  ongoing: number;
};

/**
 * 候補者1人ぶんの提案を作る。
 * @param candidateOwUserId ★**ow_users.id 空間**
 */
export async function generateProposalsForCandidate(
  candidateOwUserId: string,
): Promise<GenerateResult> {
  const db = createAdminClient();

  /* ── ★本人が企業からの連絡を受け取る設定か（2026-09-21 に追加）──────────
     ⚠️★**スカウトと同じ述語を使う。** `can_send_scout()`（SQL）の条件1を
        TS に写したのが `isReachableByCompanies()`。**ここに条件を書き写さない。**
     ⚠️★**2026-09-21 まで提案はこれを一切見ていなかった。** 実測では実ユーザー10人中
        4人（`no_contact` 2 / 未設定 2）が「スカウトは届かないのに提案は出る」状態で、
        押せば氏名が企業に渡った。**設定の意味を後から拡大しない**（CLAUDE.md）。
     ⚠️ `ow_profiles.user_id` は **auth 空間**。`ow_users.id` で引くと常に0件になる。
     ⚠️ 既に作られた提案は消さない（送信済みのスカウトを消さないのと同じ）。
        ただし開示には本人が「興味がある」を押す必要があるので、勝手には渡らない。 */
  const { data: me, error: meErr } = await db
    .from("ow_users").select("auth_id").eq("id", candidateOwUserId).maybeSingle();
  if (meErr) console.error("[evidence/generate] ow_users:", meErr.message);
  const authId = (me?.auth_id as string | null) ?? null;

  const { data: prof, error: profErr } = authId
    ? await db.from("ow_profiles").select("career_stance").eq("user_id", authId).maybeSingle()
    : { data: null, error: null };
  if (profErr) console.error("[evidence/generate] ow_profiles:", profErr.message);

  const stance = (prof?.career_stance as string | null) ?? null;
  if (!isReachableByCompanies(stance)) {
    return {
      examined: 0, proposable: 0, created: 0, skipped: 0, belowThreshold: 0,
      withoutBizAccount: 0,
      hiddenByCandidate: 0,
      ongoing: 0,
      blockedByStance: { stance },
    };
  }

  // ── 掲載中の企業だけを母数にする ──────────────────────────────────────────
  /* ⚠️ `.eq("listing_status","listed")` を直書きしないこと（CLAUDE.md）。
        求職者に見せる一覧・検索・提案は `filterListedCompanies` を通す。 */
  const { data: companyRows, error: coErr } = await filterListedCompanies(
    db.from("ow_companies").select("id"),
  );
  if (coErr) {
    console.error("[evidence/generate] ow_companies:", coErr.message);
    throw new Error(`掲載企業の取得に失敗しました: ${coErr.message}`);
  }

  /* ── ★答えられる企業だけに絞る（2026-09-21 / 柴さんの判断）─────────────
     `/biz` の入口は `ow_company_admins`（`is_active = true`）だけ。
     ⚠️★**実測（2026-09-21）: 掲載22社のうち、ログインできる人がいるのは 2社。**
        残り20社は提案を出しても**「会いたい」を押せる人が存在しない**ので、
        候補者が「興味がある」を押しても**永久に無回答＝行き止まり**になる。
     ⚠️★**メールを足しても解決しない。** 押す画面に入れないため
        （`docs/ops-fallback-20260915.md`「コードは『受け取る』までしかしない」）。
     ⚠️ これは恒久的な状態ではない。企業の担当者が `/biz/auth` から登録すれば
        `ow_company_admins` に行ができ、**その日から対象に戻る。**
     ⚠️★**`notification_emails` では代用しないこと。** あれは通知の宛先であって、
        **返答できるかどうかとは別**（実測でも掲載22社中0社）。 */
  const { data: adminRows, error: adErr } = await db
    .from("ow_company_admins").select("company_id").eq("is_active", true)
    /* ★招待中の行（`user_id` が NULL）を「答えられる人」に数えない（2026-10-08）。
          招待は `ow_company_admins` に `user_id = NULL, is_active = true` で入るので、
          これが無いと**まだ誰もログインできない企業**が対象に入る。
          `lib/notify/recipients.ts` と同じ条件。 */
    .not("user_id", "is", null);
  if (adErr) {
    console.error("[evidence/generate] ow_company_admins:", adErr.message);
    throw new Error(`企業の担当者の取得に失敗しました: ${adErr.message}`);
  }
  const respondable = new Set((adminRows ?? []).map((r) => r.company_id as string));

  const exclude = await companiesToExclude(candidateOwUserId);
  const listedNotMine = (companyRows ?? [])
    .map((c) => c.id as string)
    /* ★自分が在籍した（している）会社は提案しない。
       ⚠️ スカウトの `can_send_scout` は現職だけを止めるが、提案は**過去も外す**
          （既に知っている会社を「根拠つき」で薦める意味が無い）。 */
    .filter((id) => !exclude.has(id));

  /* ★答えられる企業だけを母数にする（上の注記を読むこと） */
  const respondableTargets = listedNotMine.filter((id) => respondable.has(id));
  const withoutBizAccount = listedNotMine.length - respondableTargets.length;

  /* ── ★求職者が「見せない」と決めた企業には出さない（2026-10-08 / 柴さんの指示）──
     判定は **`can_send_scout()`（SQL）をそのまま呼ぶ**。候補者検索（`/biz/candidates`）と
     同じ関数なので、**手動ブロック（`ow_scout_blocks`）の効き方が2画面でずれない。**
     ⚠️★**TS に条件を書き写さないこと。** 別実装を作ると片方だけ直る形になる。
     ⚠️★関数名に反して、中身は「この企業にこの候補者を見せてよいか」
        （転職意欲／在籍企業／手動ブロック／転職勧奨禁止）。スカウトは 2026-10-08 に
        廃止したが**この関数は消さない**（CLAUDE.md）。
     ⚠️ 失敗したら**出さない側**に倒す（fail-closed）。ただし黙らず数えて画面に出す。
     ⚠️ `p_candidate_id` は **auth 空間**。 */
  const visibility = await Promise.all(
    respondableTargets.map(async (companyId) => {
      const { data, error } = await db.rpc("can_send_scout", {
        p_company_id: companyId,
        p_candidate_id: authId,
      });
      if (error) console.error("[evidence/generate] can_send_scout:", error.message);
      return data === true;
    }),
  );
  const visibleTargets = respondableTargets.filter((_id, i) => visibility[i]);
  const hiddenByCandidate = respondableTargets.length - visibleTargets.length;

  /* ── ★同じ候補者 × 企業に進行中の提案があれば作らない（2026-10-10）────────────
     判定は画面と同じ関数（`proposalEnded.ts`）。⚠️ 条件を書き写さないこと。
     ⚠️ 見せてよいかは直前の `can_send_scout()` で確かめ済みなので visible = true で判定する。
     ⚠️ 引けなければ作らない（fail-closed）。同じ企業に2件目を作るより、作らないほうが安全 */
  const { data: existing, error: exErr } = visibleTargets.length
    ? await db.from("ow_proposals")
        .select("company_id, candidate_response, company_response, introduced_at, respond_by")
        .eq("candidate_user_id", candidateOwUserId).in("company_id", visibleTargets)
    : { data: [], error: null };
  if (exErr) {
    console.error("[evidence/generate] 既存の提案:", exErr.message);
    throw new Error(`既存の提案を確かめられませんでした: ${exErr.message}`);
  }
  const ongoingCompanies = new Set(
    (existing ?? []).filter((r) => {
      const p = {
        companyId: r.company_id as string,
        candidateUserId: candidateOwUserId,
        candidateResponse: (r.candidate_response as string | null) ?? null,
        companyResponse: (r.company_response as string | null) ?? null,
        introducedAt: (r.introduced_at as string | null) ?? null,
        respondBy: r.respond_by as string,
      };
      return !isProposalExpired(p) && !isProposalEndedFor("company", p, true) && !isProposalEndedFor("candidate", p, true);
    }).map((r) => r.company_id as string),
  );
  const targets = visibleTargets.filter((id) => !ongoingCompanies.has(id));

  const facts = await gatherCompanyFacts(candidateOwUserId, targets);
  /* ⚠️★ラベルに人称が入らないので、②と⑨で同じスナップショットを共有できる。
        以前は `"candidate"` を渡しており、**企業側に「あなたと同じ職種から」と
        出ていた**（2026-09-18 に直した）。 */
  const opts = evidenceOptions();

  const rows: Record<string, unknown>[] = [];
  let belowThreshold = 0;

  for (const f of facts) {
    const evidence = buildEvidence(f.evidence, opts);
    if (!isProposable(evidence)) {
      belowThreshold += 1;
      continue;
    }
    rows.push({
      candidate_user_id: candidateOwUserId,
      company_id: f.companyId,
      job_id: f.jobId,
      evidence,
      /* ⚠️ 反証は必ず1件以上返る（`buildCounterEvidence` が `unknown` を足す）。
            DB の CHECK（`counter_min_1`）も同じことを要求している。 */
      counter_evidence: buildCounterEvidence(f.counter, opts),
    });
  }

  let created = 0;
  if (rows.length > 0) {
    /* ⚠️ `ignoreDuplicates: true` ＝ `on conflict do nothing`。
          ★既存の提案のスナップショットを上書きしないため（冒頭を参照）。 */
    const { data, error } = await db
      .from("ow_proposals")
      .upsert(rows, {
        onConflict: "candidate_user_id,company_id,job_id",
        ignoreDuplicates: true,
      })
      .select("id, candidate_user_id, company_id");
    if (error) {
      console.error("[evidence/generate] ow_proposals upsert:", error.message);
      throw new Error(`提案の作成に失敗しました: ${error.message}`);
    }
    created = (data ?? []).length;

    /* ★届いたことを知らせる。⚠️ `ignoreDuplicates` なので `data` に返るのは
          **新規の行だけ** ——既存の提案を作り直したときに二重に知らせない。
       ⚠️ best-effort。通知に失敗しても提案の作成は成功のままにする。 */
    await notifyProposalsCreated(
      (data ?? []).map((r) => ({
        id: r.id as string,
        candidateUserId: r.candidate_user_id as string,
        companyId: r.company_id as string,
      })),
    );
  }

  return {
    examined: facts.length,
    proposable: rows.length,
    created,
    skipped: rows.length - created,
    belowThreshold,
    withoutBizAccount,
    hiddenByCandidate,
    ongoing: ongoingCompanies.size,
  };
}

export { MIN_EVIDENCE_FOR_PROPOSAL };
