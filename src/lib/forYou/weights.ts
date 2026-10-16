/**
 * ★「あなたに合う会社」（/mypage/proposals）の下段「すべての会社を合う順に」の重みと理由文。**並べ方の定数はこの1ファイルだけ。**
 * ⚠️ 2026-10-15 に /mypage/for-you（あなたに合う順）から統合した。/mypage/for-you は middleware が転送する
 *
 * 根拠の実測は docs/phase0-for-you-20261015.md（2026-10-15）。決めたこと（柴さん）:
 *   - 相性は**並び順と理由**に使う。掲載企業は原則すべて並べる（足切りはブロック中・在籍中の企業だけ）
 *   - LLM は使わない。点数も理由文もこのファイルの定数とルールで作る
 *   - 理由は**データで言えること**だけ。シグナルが無い会社に理由を作らない（行ごと出さない）
 *
 * ⚠️ このファイルは import を持たない（クライアントの画面からも読むため。admin クライアントを混ぜない）。
 *
 * ── 使わないシグナル（★コードに入れていない。入れるときはここの判断を読み直すこと）─────────────
 *
 * S1（企業の対象業界 × 職歴の業界）… **0件**。掲載企業21社がすべて `horizontal`（業界を問わない）で、
 *   対象業界を持つ企業が無い（2026-10-15 実測）。代わりに S1′（事業領域の一致）を使う。
 *
 * S3（入社理由の重なり）… ★**保留**。理由データ（join_reasons）は**非公開・本人と集計のみ**で、
 *   重なりがある組み合わせ32件のうち、**社員の回答が3人以上ある組み合わせは0件**だった。
 *   1〜2人で「この会社の社員も◯◯を決め手にしています」と出すと、その社員の非公開の回答を本人に見せることになる。
 *   並び順にだけ使っても、上下の差から推測できる。**1社3人以上（MIN_AGGREGATE_COUNT）になるまで入れない。**
 *
 * S4（元同僚）… ★**今回は入れない**。足しても理由がつく人が1人も増えず（S1′+S2+S5 と分布が完全に一致）、
 *   プライバシーの論点（1人だけの企業では件数が個人を指す・相手が知らないところでつながりを見せる）だけが増える。
 *   調べた結果は docs/phase0-for-you-20261015.md §4。ものさしと社員の声が育った段階で再検討する。
 *
 * S6（話を聞ける人）… **タグとしてだけ出す。点数には入れない**（掲載企業で2社しか無く、
 *   入れると全員の上位に同じ2社が上がる）。
 *
 * S7（有効な担当者）… 並び順には使わない。「興味あり」を押したときの行き先の判定にだけ使う。
 */

export type SignalKey = "same_domain" | "role_opening" | "moved_from_domain" | "phase_match";

/**
 * 点数。**大きい順に理由文の候補になる**（上位2つまで出す）。
 *
 * - role_opening 40 … いま募集している求人の職種が、本人の職種（職歴・希望）と同じ系統。
 *   「入れる席がある」という最も具体的な接点なので最大。ただし公開求人がある掲載企業は1社だけ（2026-10-15）
 * - same_domain 30 … これまでの勤務先と同じ事業領域。運営が1社ずつ入れた分類なので事実として言える。
 *   14人・14社に効く、いちばん広く効くシグナル
 * - moved_from_domain 10 … 本人の勤務先と**同じ事業領域**の会社から、この会社へ移った人がいる。
 *   ★2026-10-15 に「同じ**業種**から移った人」（15点）から変えた（柴さんの指示）。業種で見ると
 *   掲載企業の大半が「IT・インターネット」でほぼ全員に当たり、情報の価値が低かった。
 *   事業領域で見ると 16人→12人・3社→2社に減るが、言えることが具体的になる（実測 2026-10-15）。
 *   重みも 15→10 に下げた（same_domain より下・phase_match より上）
 * - phase_match 5 … 本人が希望したフェーズと一致。回答者が3人しかいないので小さく（柴さんの判断）
 */
export const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  role_opening: 40,
  same_domain: 30,
  moved_from_domain: 10,
  phase_match: 5,
};

/** 理由文として出す最大数（カードの最大2行） */
export const MAX_REASONS_PER_COMPANY = 2;

/**
 * 同点のときの並べ方（★ランダムにしない）:
 *   ① 点数の高い順
 *   ② シグナルの数が多い順
 *   ③ 表示名の五十音順（`localeCompare(…, "ja")`）
 * ⚠️ ③で同名はありえない（掲載企業の表示名は一意）が、最後に id で決める。
 */
export const TIE_BREAK_NOTE = "score desc → signal count desc → display name (ja) → id";

/* ── 理由文 ─────────────────────────────────────────────────────────────────── */

export type SignalDetail =
  | { key: "same_domain"; domainName: string; fromCurrent: boolean }
  | { key: "role_opening"; roleName: string; fromDesired: boolean }
  | { key: "moved_from_domain"; domainName: string; fromCurrent: boolean }
  | { key: "phase_match"; phaseLabel: string };

/**
 * 理由文。★**データで言えることだけ**。人数は出さない（1人しかいない組み合わせがほとんどで、件数が個人を指すため）。
 */
export function reasonText(s: SignalDetail): string {
  switch (s.key) {
    case "same_domain":
      /* 一致した職歴が現職なら「いまの勤務先」。⚠️ 現職を「前職」と書かない */
      return s.fromCurrent
        ? `いまの勤務先と同じ${s.domainName}領域の会社です`
        : `前職と同じ${s.domainName}領域の会社です`;
    case "role_opening":
      return s.fromDesired
        ? `希望職種（${s.roleName}）の募集があります`
        : `あなたの経験職種（${s.roleName}）の募集があります`;
    case "moved_from_domain":
      return s.fromCurrent
        ? `いまの勤務先と同じ${s.domainName}領域の会社から、この会社に移った人がいます`
        : `前職と同じ${s.domainName}領域の会社から、この会社に移った人がいます`;
    case "phase_match":
      return `希望しているフェーズ（${s.phaseLabel}）の会社です`;
  }
}

/**
 * ★下段で会社をまとめるときの見出し（2026-10-15）。**1番目の理由（点数の最も高いシグナル）で束ねる。**
 *   reasonText と同じ事実を、見出しの形（「〜の会社です」を外した形）で言う。
 * ⚠️ 見出しにした理由はカードの中で繰り返さない（カードには2つ目以降の理由だけ出す）
 */
export function groupLabel(s: SignalDetail): string {
  switch (s.key) {
    case "same_domain":
      return `${s.fromCurrent ? "いまの勤務先" : "前職"}と同じ${s.domainName}領域`;
    case "role_opening":
      return s.fromDesired ? `希望職種（${s.roleName}）の募集がある会社` : `あなたの経験職種（${s.roleName}）の募集がある会社`;
    case "moved_from_domain":
      return `${s.fromCurrent ? "いまの勤務先" : "前職"}と同じ${s.domainName}領域の会社から、人が移っている会社`;
    case "phase_match":
      return `希望しているフェーズ（${s.phaseLabel}）の会社`;
  }
}

/** 本人の希望フェーズ（`ow_profiles.desired_phase` は日本語ラベル）→ `lib/constants/phase.ts` の選択肢 */
export const DESIRED_PHASE_TO_OPTION: Record<string, { option: string; label: string }> = {
  "シリーズA": { option: "series_a", label: "シリーズA" },
  "シリーズB": { option: "series_b", label: "シリーズB" },
  "シリーズC": { option: "series_c", label: "シリーズC" },
  "上場": { option: "listed", label: "上場企業" },
};

/* ── 反応 ─────────────────────────────────────────────────────────────────── */

/** ⚠️ DB の CHECK（ow_for_you_reactions_reaction_check）と同じ3つ */
export const FOR_YOU_REACTIONS = ["interested", "later", "not_interested"] as const;
export type ForYouReaction = (typeof FOR_YOU_REACTIONS)[number];

export function isForYouReaction(v: unknown): v is ForYouReaction {
  return typeof v === "string" && (FOR_YOU_REACTIONS as readonly string[]).includes(v);
}

/**
 * ★担当者のいない企業への「興味あり」を運営に1件ずつメールする上限の目安（柴さんの判断）。
 *   1日にこれを超えるようになったら、まとめての通知に切り替える（`lib/forYou/notifyOps.ts` の1か所を変える）。
 *   いまは超えたら警告のログを出すだけ。
 */
export const OPS_NOTIFY_DAILY_SOFT_LIMIT = 10;

/** 理由が1つも無い人に出す文（柴さんの指示） */
export const NO_REASON_PROMPT = "職歴を追加すると、あなたに合う理由が表示されます";
