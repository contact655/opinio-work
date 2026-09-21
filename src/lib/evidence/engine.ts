/**
 * 根拠エンジン（②⑨の心臓）。**純粋関数だけ。DB に触らない。**
 *
 * ── ★このファイルが何も import しない理由 ───────────────────────────────────
 * テストを `node --test` で**素の Node から直接**走らせるため。
 * `@/` エイリアスは bundler（webpack）が解決するもので、素の Node では解決できない。
 * 1つでも `@/...` を import すると、そこから `createAdminClient` まで芋づるで
 * 引き込まれ、**テストが起動しない。**
 *
 * ⚠️★**このファイルに import を足さないこと。** 足した瞬間にテストが動かなくなる。
 *    DB から値を取るのは [fetch.ts](./fetch.ts) の仕事。ここは受け取った事実を
 *    文にするだけ。
 *
 * ⚠️★**しきい値を定数として import しない。** 同じ理由。呼び出し側が
 *    `EvidenceOptions` で渡す。`fetch.ts` が
 *    `@/lib/constants/aggregate` の `MIN_AGGREGATE_COUNT` を渡しており、
 *    **引数が必須なので渡し忘れようがない**（省略可能にすると既定値が
 *    2つ目のしきい値になる。CLAUDE.md「定数は1つ」）。
 *
 * ── ★②と⑨は同じ関数から作る ───────────────────────────────────────────────
 * 求職者向けと企業向けで別実装にしない。**判定も文面も同じ**で、
 * 「誰の話か」は画面側の見出しと導入文だけが担う（下の `Audience` の注記）。
 * 2つ書くと必ず食い違う（CLAUDE.md「同じ名前の別実装を作らないこと」）。
 *
 * ── ★スコアを出さない ───────────────────────────────────────────────────────
 * マッチ度%・星評価は出さない（Hisato 思想⑦）。並べ替えは**根拠の件数**で行う。
 * `preference_match` は `scoreJob()` の結果を使うが、**点数は捨てて理由文だけ**を使う。
 */

// ── しきい値 ─────────────────────────────────────────────────────────────────

/**
 * 提案として出してよい根拠の最小件数。
 *
 * ⚠️ これを下回る組み合わせは**一覧に出さない**。ただし**件数は出す**
 *    （「根拠を2件以上そろえられたのは N 社でした」）。黙って消さない。
 */
export const MIN_EVIDENCE_FOR_PROPOSAL = 2;

export type EvidenceOptions = {
  /**
   * 人数の集計を「割合」にしてよい下限。
   * ⚠️ 呼び出し側が `MIN_AGGREGATE_COUNT` を渡す。**既定値を置かない。**
   */
  minAggregate: number;
};

/**
 * ★★**ラベルに人称を入れない**（2026-09-18 に直した）。
 *
 * ── なぜ ────────────────────────────────────────────────────────────────────
 * 根拠は**作成時にスナップショットとして保存**される（`ow_proposals.evidence`）。
 * 当初 `audience` で「あなたと同じ…」/「この方と同じ…」を作り分けていたが、
 * **保存されるのは1つだけ**なので、②（求職者向け）で作った文が
 * **⑨（企業向け）にそのまま出て「あなたと同じ職種から」と企業に表示されていた。**
 *
 * → **事実に人称は無い。** ラベルは「アカウントエグゼクティブから、A社へ 3人が移っています」
 *    のように主語を持たない形にし、**誰の話かは画面側の枠（見出し・導入文）で示す。**
 *
 * ⚠️★**`audience` を引数に戻さないこと。** 戻すと同じ事故に戻る
 *    （スナップショットは1つしか持てない）。
 */
export type Audience = "candidate" | "company";

// ── 型 ───────────────────────────────────────────────────────────────────────

export type EvidenceKind =
  | "same_path"        // ある職種・業界から、その企業へ移った人の数
  | "shared_motive"    // その人たちが挙げた入社の決め手と、候補者の希望の一致
  | "talkable"         // その企業で isTalkable() を通る人の数
  | "preference_match"; // 候補者の希望条件と企業属性の一致

export type Evidence = {
  kind: EvidenceKind;
  /** 母数。★`preference_match` は人数ではなく「一致した条件の数」 */
  n: number;
  /**
   * n のうち該当する数。
   * ⚠️★**`n < minAggregate` のときは `undefined`。** 比率を出すと n=1 のとき
   *    「その1人が何を選んだか」が丸見えになる。件数（n）だけ出す。
   */
  k?: number;
  /** 画面に出す1行。★ここで作る。呼び出し側で組み立て直さないこと */
  label: string;
  /** どうやって出した値かの記録。★監査用で、画面には出さない */
  sourceQuery: string;
};

export type CounterEvidenceKind =
  | "short_tenure"   // 短期離職
  | "salary_gap"     // 提示年収と希望年収のずれ
  | "work_style_gap" // 勤務形態のずれ
  | "unknown";       // ★「確かめていない」。省略の代わりに必ず出す

export type CounterEvidence = {
  kind: CounterEvidenceKind;
  label: string;
};

// ── 入力（fetch.ts が集める事実）────────────────────────────────────────────

/**
 * ⚠️★**`null` と「0件」を区別すること。**
 *    `null` = そもそも測っていない／測れない
 *    `{ n: 0 }` = 測ったが0件だった
 *    この2つを同じに扱うと、CLAUDE.md の「起きなかった0か、起こせなかった0か」を
 *    エンジンの中で潰すことになる。
 */
export type EvidenceFacts = {
  companyName: string;
  samePath: {
    n: number;
    /** 移る前の職種名。null なら自由入力で解決できなかった */
    fromRoleName: string | null;
    /** 移る前の業種名。null なら同上 */
    fromIndustryName: string | null;
  } | null;
  sharedMotive: {
    /** 決め手を答えた在籍者の数 */
    n: number;
    /** うち、候補者の希望と同じ軸を挙げた数 */
    k: number;
    /** 一致した決め手のラベル（例「裁量の大きさ」） */
    reasonLabel: string;
  } | null;
  talkable: { n: number } | null;
  preference: {
    /** 一致した条件のラベル（scoreJob の reasonParts をそのまま渡す） */
    matchedLabels: string[];
  } | null;
};

export type CounterFacts = {
  /** その企業の在籍者のうち、在籍1年未満で辞めた人 */
  shortTenure: { n: number; total: number } | null;
  /** 提示年収（求人）と希望年収。★現年収は使わない（実データ0件・GRANT も無い） */
  salaryGap: {
    jobMin: number | null;
    jobMax: number | null;
    wantMin: number | null;
    wantMax: number | null;
  } | null;
  workStyleGap: {
    /** 企業・求人側の勤務形態 */
    actual: string | null;
    /** 候補者が希望した勤務形態 */
    wanted: string[];
  } | null;
};

// ── 根拠を作る ───────────────────────────────────────────────────────────────

/**
 * 事実 → 根拠の文。**件数の多い順に並べる。スコアは使わない。**
 *
 * ⚠️ 測れなかったもの（`null`）は**根拠にしない**。0件（`{ n: 0 }`）も根拠にしない。
 *    「0人が移っています」は根拠ではない。
 */
export function buildEvidence(facts: EvidenceFacts, opts: EvidenceOptions): Evidence[] {
  const out: Evidence[] = [];

  // ── ① same_path ───────────────────────────────────────────────────────────
  if (facts.samePath && facts.samePath.n > 0) {
    const { n, fromRoleName, fromIndustryName } = facts.samePath;
    /* ⚠️ 職種と業種のどちらが解決できたかで文が変わる。**両方 null でも件数は出す。**
          「◯◯から」を既定値（「他社」など）で埋めないこと。 */
    const from =
      fromRoleName && fromIndustryName ? `${fromIndustryName}の${fromRoleName}`
      : fromRoleName   ? fromRoleName
      : fromIndustryName ? fromIndustryName
      : null;
    out.push({
      kind: "same_path",
      n,
      /* ★人称を入れない（上の Audience の注記を参照）。
            「あなた」「この方」は画面側の見出しと導入文が担う。 */
      label: from
        ? `${from}から、${facts.companyName}へ ${n}人が移っています`
        : `同じ職種から、${facts.companyName}へ ${n}人が移っています`,
      sourceQuery: "ow_transitions",
    });
  }

  // ── ② shared_motive ───────────────────────────────────────────────────────
  if (facts.sharedMotive && facts.sharedMotive.n > 0 && facts.sharedMotive.k > 0) {
    const { n, k, reasonLabel } = facts.sharedMotive;
    /* ★★n が下限未満なら比率を出さない。
       ⚠️ n=1 で「1人中1人が『裁量』を挙げた」と出すと、**その1人が何を選んだかが
          そのまま読める。** 決め手は本人と集計にしか出さない約束
          （careerReasons.ts「理由データ3種は非公開。本人と集計のみ」）なので、
          ここで割合にすると約束を破る。件数だけにする。 */
    const enough = n >= opts.minAggregate;
    out.push({
      kind: "shared_motive",
      n,
      k: enough ? k : undefined,
      label: enough
        ? `入社の決め手を答えた ${n}人のうち ${k}人が「${reasonLabel}」を挙げています`
        : `入社の決め手として「${reasonLabel}」を挙げた人がいます`,
      sourceQuery: "ow_experiences.join_reasons",
    });
  }

  // ── ③ talkable ────────────────────────────────────────────────────────────
  if (facts.talkable && facts.talkable.n > 0) {
    const { n } = facts.talkable;
    out.push({
      kind: "talkable",
      n,
      label: `${facts.companyName}には、話を聞ける人が ${n}名います`,
      sourceQuery: "ow_company_members + ow_experiences(is_current)",
    });
  }

  // ── ④ preference_match ────────────────────────────────────────────────────
  if (facts.preference && facts.preference.matchedLabels.length > 0) {
    const labels = facts.preference.matchedLabels;
    out.push({
      kind: "preference_match",
      /* ★ここだけ n は人数ではなく「一致した条件の数」。
         ⚠️ 人数と同じ軸で並べ替えると、条件が4つ一致しただけの会社が
            「4人が移った会社」より上に来る。**並べ替えは件数ではなく
            根拠の本数で行う**（sortByEvidenceCount）ので実害は無いが、
            ここを人数として読まないこと。 */
      n: labels.length,
      /* ⚠️★matchCompanyPreference が返すのは「一致した項目」で、文ではない。
            「希望条件と ◯◯ が一致しています」に埋めると**二重の文**になる
            （2026-09-21 まで「希望条件と 希望フェーズ（listed）にマッチ が一致しています」
            と画面に出ていた）。**文はここで組む。** */
      label: `${labels.join("・")}に合っています`,
      sourceQuery: "scoreJob(reasonParts)",
    });
  }

  /* ★件数ではなく「根拠の本数」で並べるので、ここでは kind の優先順で安定させる。
     ⚠️ `n` の降順にしないこと。④の n は人数ではないので混ざる。 */
  const ORDER: EvidenceKind[] = ["same_path", "shared_motive", "talkable", "preference_match"];
  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

// ── 反証を作る ───────────────────────────────────────────────────────────────

/**
 * 都合の悪い事実。**必ず1件以上返す。**
 *
 * ⚠️★**1件も計算できなければ `unknown`（「確かめていない」）を返す。省略しない。**
 *    反証が無い＝問題が無い、ではない。**測っていないだけ**かもしれない。
 *    黙って消すと、根拠だけが並んだ画面になる。
 *
 * ⚠️★**年齢は使わない**（2026-09-18 の判断）。
 *    ① ⑨は `/biz` 配下なので、候補者の年齢・年代を企業に渡すこと自体が方針違反
 *       （労働施策総合推進法9条。CLAUDE.md「年齢は詳細だけ」）。
 *    ② 「在籍者の年齢分布」は集計なら別物だが、成立には `minAggregate` が要る。
 *       現在の最大 n は1で、n=1〜2 では**個人の年齢そのもの**になる。
 *    ⚠️ **型にも置いていない。** 置くといつでも書ける状態が残る
 *       （`CompanyEmployee` から `birthYear` を落としたのと同じ担保）。
 */
export function buildCounterEvidence(facts: CounterFacts, opts: EvidenceOptions): CounterEvidence[] {
  const out: CounterEvidence[] = [];

  // ── 短期離職 ──────────────────────────────────────────────────────────────
  if (facts.shortTenure && facts.shortTenure.total > 0 && facts.shortTenure.n > 0) {
    const { n, total } = facts.shortTenure;
    const enough = total >= opts.minAggregate;
    out.push({
      kind: "short_tenure",
      label: enough
        ? `退職した ${total}人のうち ${n}人は、在籍1年未満で離れています`
        : `在籍1年未満で離れた人がいます`,
    });
  }

  // ── 年収のずれ ────────────────────────────────────────────────────────────
  if (facts.salaryGap) {
    const { jobMin, jobMax, wantMin, wantMax } = facts.salaryGap;
    /* ⚠️★**現年収との比較は作れない。** `ow_experiences.salary_man` は
          実ユーザー0件で、`authenticated` から SELECT の GRANT も剥がしてある
          （2026-08-06）。ここは**希望年収との比較**。取り違えないこと。 */
    if (jobMax != null && wantMin != null && jobMax < wantMin) {
      out.push({
        kind: "salary_gap",
        label: `提示されている上限（${jobMax}万円）は、希望の下限（${wantMin}万円）に届きません`,
      });
    } else if (jobMin != null && wantMax != null && jobMin > wantMax) {
      out.push({
        kind: "salary_gap",
        label: `提示されている下限（${jobMin}万円）は、希望の上限（${wantMax}万円）を超えています`,
      });
    }
  }

  // ── 勤務形態のずれ ────────────────────────────────────────────────────────
  if (facts.workStyleGap) {
    const { actual, wanted } = facts.workStyleGap;
    if (actual && wanted.length > 0 && !wanted.includes(actual)) {
      out.push({
        kind: "work_style_gap",
        label: `勤務形態は「${actual}」で、希望（${wanted.join("・")}）とは異なります`,
      });
    }
  }

  /* ★★最後の砦。ここを消さないこと。 */
  if (out.length === 0) {
    out.push({
      kind: "unknown",
      label: "都合の悪い点は確かめていません（在籍期間・年収・勤務形態のデータが足りていません）",
    });
  }

  return out;
}

// ── 提案に出すかどうか ───────────────────────────────────────────────────────

/**
 * 根拠が足りているか。
 * ⚠️ 足りない組み合わせは**一覧に出さない**が、**件数は画面に出す**
 *    （「根拠を2件以上そろえられたのは N 社でした」）。呼び出し側で数えること。
 */
export function isProposable(evidence: Evidence[]): boolean {
  return evidence.length >= MIN_EVIDENCE_FOR_PROPOSAL;
}

/** 根拠の本数が多い順。同数なら companyName で安定させる */
export function sortByEvidenceCount<T extends { evidence: Evidence[]; companyName: string }>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      b.evidence.length - a.evidence.length ||
      a.companyName.localeCompare(b.companyName, "ja"),
  );
}
