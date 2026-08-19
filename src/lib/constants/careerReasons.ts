/**
 * 経歴の「理由データ」と「勤務地」の選択肢。**クライアントと API の両方がここを見る。**
 *
 * ── なぜ1箇所に集めるか ─────────────────────────────────────────────────────
 * careerOptions.ts / careerPreferences.ts と同じ理由。選択肢を JSX に直書きすると
 * API 側の許容値とずれ、**選べるのに保存されない**状態が静かに生まれる
 * （2026-07-01 に employment_type で実際に起き、「派遣社員」が消えていた）。
 *
 * ⚠️ 選択肢を増やすときはこの1箇所を直し、**DB の CHECK も同時に広げる**。
 *    CLAUDE.md「選択肢が決まっている値は UI / API / DB の CHECK を3つ揃える」。
 *    どれか1つでも忘れると「選べるのに保存できない」か
 *    「保存できるのに絞れない」のどちらかになる。
 *
 * ── ★スラッグの扱い（2026-08-19 に一度だけ作り直した）────────────────────
 * ⚠️ **値は英字スラッグで固定。ここから先は削除も改名もしない（追加のみ）。**
 *    2026-08-19 に軸を揃えるため**入社・退職のスラッグをまとめて作り直した**。
 *    これができたのは、その時点で `join_reasons` / `join_reason_primary` /
 *    `leave_reasons` / `ow_experience_gaps` が**実データ0件**だったから。
 *    **1件でも入った後は二度とやらない**（過去の回答が意味を失う）。
 *    ラベルを変えるのは自由。value を変えると DB の CHECK と既存行が壊れる。
 *    旧→新の対応表は `20260819140000_career_reasons_axes_and_limit.sql` に残してある。
 *
 * ── ★並び順（2026-08-19 に確定。以後変えない）─────────────────────────────
 * ⚠️ **上に置いた選択肢ほど選ばれやすい。** 並び順を後から変えると、
 *    選択率の変化が「利用者の傾向が変わった」のか「位置を変えたから」なのか
 *    区別できなくなる。**軸の順も、軸の中の順も、この並びで固定する。**
 *
 *    軸の並びは「転職の意思決定で先に語られる順」に置いた：
 *      仕事の中身 → 裁量・役割 → 人・組織 → 待遇 → 働き方 → 会社の状態 → 個人の事情
 *    各軸の中は「仕事に近いもの → 条件に近いもの」。
 *    決めた日: 2026-08-19。
 *
 * ── ★入社側と退職側で軸を対応させている ───────────────────────────────────
 * 「裁量を決め手に入った人の何%が、裁量を理由に辞めているか」を出すため、
 * **同じ軸・同じスラッグを両側に置いている**（11個が共通）。
 * 片側にしか無いのは3つだけ:
 *   入社のみ `stability`（知名度・安定性）
 *   退職のみ `management`（マネジメント・上司）/ `restructure`（会社都合・組織変更）
 * ⚠️ **新しい選択肢を足すときは、対になる側があるかを必ず考えること。**
 *    片側だけ足すと、その軸の突き合わせができなくなる。
 *
 * ── ★軸は DB に持たせない ─────────────────────────────────────────────────
 * ⚠️ `axis` は**このファイルにしか無い**。DB は選択肢スラッグだけを保存する。
 *    軸は後から切り方を変える前提なので、CHECK に入れると変更のたびに migration が要る。
 *    **軸を変えても選択肢IDが不変**であることが、集計をやり直せる条件になる。
 *
 * ── ★順位（rank）は持たない ───────────────────────────────────────────────
 * ⚠️ **`rank` 列は作らない。`join_reasons` は `text[]` のままにする。**
 *    選択は3つまでの**等重み**で、順位は取らない。タップ順は「重要度の順」ではなく
 *    「目に入った順」になるため、順位として読むと誤る。
 *    そのうえで「いちばんの決め手」だけは `join_reason_primary` で**明示的に1つ**選ばせる。
 *    3つ上限なので3択にしかならず、負担も小さい。
 *    順位が要ると分かったら、そのとき別テーブル（experience_id, reason, rank）に
 *    切り出す。**先回りして配列を jsonb や別テーブルにしない。**
 *
 * ── 公開範囲 ───────────────────────────────────────────────────────────────
 * ⚠️ **理由データ3種（入社理由 / 退職理由 / ギャップ）は非公開。本人と集計のみ。**
 *    他ユーザー・企業には一切出さない。/u/[id] /people 企業詳細 スカウト
 *    /biz/candidates のどこにも出さないこと。
 *
 * ⚠️ 権限の実態は**受け皿ごとに違う**（2026-08-19 実測）。
 *    `ow_experiences` の3列  … `authenticated` は SELECT **不可** / UPDATE 可。
 *                                読むには admin クライアントが要る。
 *    `ow_experience_gaps`    … `authenticated` に SELECT/INSERT/UPDATE/DELETE があり、
 *                                RLS（`ow_experience_gaps_own_manage`）で本人に絞っている。
 *    （20260811184225_experience_location_and_reasons.sql）
 *
 * ⚠️ 既存の `ow_experiences.join_reason`（自由記述・公開トグル visibility_reason つき）
 *    とは**別物**。あちらは撤去予定だが、このファイルは関与しない。
 */

import { PREFECTURES } from "@/lib/utils/location";
import { VALID_REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

// ── 軸 ────────────────────────────────────────────────────────────────────────

/**
 * 選択肢をまとめる軸。**UI の小見出しにしか使わない。DB には保存しない。**
 *
 * ⚠️ 軸は**タップ対象にしない**。押して降りる階層を作ると、選ぶまでの手数が増える。
 *    見出しとして置くだけで、押せるのは選択肢だけ。
 */
export const REASON_AXES = [
  { value: "work",     label: "仕事の中身" },
  { value: "role",     label: "裁量・役割" },
  { value: "org",      label: "人・組織" },
  { value: "pay",      label: "待遇" },
  { value: "worklife", label: "働き方" },
  { value: "company",  label: "会社の状態" },
  { value: "personal", label: "個人の事情" },
] as const;

export type ReasonAxis = (typeof REASON_AXES)[number]["value"];

export type ReasonOption = { value: string; label: string; axis: ReasonAxis };

/** 選べる上限。**UI / API / DB の CHECK の3層が同じ値を見る。** */
export const REASON_MAX = 3;

// ── 入社理由 ──────────────────────────────────────────────────────────────────

export const JOIN_REASONS: readonly ReasonOption[] = [
  { value: "job_content", label: "事業内容・プロダクト",     axis: "work" },
  { value: "skills",      label: "身につくスキル",           axis: "work" },
  { value: "autonomy",    label: "裁量の大きさ",             axis: "role" },
  { value: "position",    label: "ポジション・役割",         axis: "role" },
  { value: "people",      label: "一緒に働く人",             axis: "org" },
  { value: "culture",     label: "組織のカルチャー",         axis: "org" },
  { value: "salary",      label: "年収・待遇",               axis: "pay" },
  { value: "evaluation",  label: "評価・昇進の仕組み",       axis: "pay" },
  { value: "work_style",  label: "働き方（場所・時間）",     axis: "worklife" },
  { value: "growth",      label: "事業の成長性",             axis: "company" },
  { value: "stability",   label: "知名度・安定性",           axis: "company" },
  { value: "personal",    label: "タイミング・個人の事情",   axis: "personal" },
] as const;

export const JOIN_REASON_LABELS: Record<string, string> =
  Object.fromEntries(JOIN_REASONS.map((o) => [o.value, o.label]));

export const VALID_JOIN_REASONS = new Set<string>(JOIN_REASONS.map((o) => o.value));

// ── 退職理由 ──────────────────────────────────────────────────────────────────

/**
 * ⚠️ 11個のスラッグは**入社側と共通**（軸を突き合わせるため）。別の列に入るので衝突しない。
 *    **ラベル辞書は共通化しないこと。** 同じ `growth` でも
 *    入社は「事業の成長性」、退職は「事業の先行き」で、言い方が違う。
 */
export const LEAVE_REASONS: readonly ReasonOption[] = [
  { value: "job_content", label: "仕事内容が合わなかった",       axis: "work" },
  { value: "skills",      label: "スキルの伸び代が無かった",     axis: "work" },
  { value: "autonomy",    label: "裁量が小さかった",             axis: "role" },
  { value: "position",    label: "ポジション・役割が変わった",   axis: "role" },
  { value: "people",      label: "一緒に働く人",                 axis: "org" },
  { value: "culture",     label: "組織のカルチャー",             axis: "org" },
  { value: "management",  label: "マネジメント・上司",           axis: "org" },
  { value: "salary",      label: "年収・待遇",                   axis: "pay" },
  { value: "evaluation",  label: "評価のされ方・昇進",           axis: "pay" },
  { value: "work_style",  label: "働き方（場所・時間）",         axis: "worklife" },
  { value: "growth",      label: "事業の先行き",                 axis: "company" },
  { value: "restructure", label: "会社都合・組織変更",           axis: "company" },
  { value: "personal",    label: "個人の事情（家庭・健康など）", axis: "personal" },
] as const;

export const LEAVE_REASON_LABELS: Record<string, string> =
  Object.fromEntries(LEAVE_REASONS.map((o) => [o.value, o.label]));

export const VALID_LEAVE_REASONS = new Set<string>(LEAVE_REASONS.map((o) => o.value));

/**
 * 軸ごとにまとめる。**並び順は `REASON_AXES` と各配列の順をそのまま使う**
 * （UI 側で sort し直さないこと。並び順を固定した意味が無くなる）。
 * 選択肢が1つも無い軸は返さない。
 */
export function groupReasonsByAxis(
  options: readonly ReasonOption[]
): { axis: ReasonAxis; axisLabel: string; options: ReasonOption[] }[] {
  return REASON_AXES.map((a) => ({
    axis: a.value,
    axisLabel: a.label,
    options: options.filter((o) => o.axis === a.value),
  })).filter((g) => g.options.length > 0);
}

// ── 入社前後のギャップ ────────────────────────────────────────────────────────

export const GAP_AXES = [
  { value: "autonomy",       label: "裁量の大きさ" },
  { value: "onboarding",     label: "教育・オンボーディング" },
  { value: "work_hours",     label: "労働時間" },
  { value: "evaluation",     label: "評価の納得感" },
  { value: "decision_speed", label: "意思決定のスピード" },
  { value: "client_quality", label: "顧客・案件の質" },
] as const;

export const GAP_AXIS_LABELS: Record<string, string> =
  Object.fromEntries(GAP_AXES.map((o) => [o.value, o.label]));

export const VALID_GAP_AXES = new Set<string>(GAP_AXES.map((o) => o.value));

/**
 * ⚠️ 「未回答」という value を作らないこと。未回答は
 *    `ow_experience_gaps` に**行が無い**ことで表す。
 */
export const GAP_RATINGS = [
  { value: "better",      label: "想像より良かった" },
  { value: "as_expected", label: "想像通り" },
  { value: "worse",       label: "想像より厳しかった" },
] as const;

export const GAP_RATING_LABELS: Record<string, string> =
  Object.fromEntries(GAP_RATINGS.map((o) => [o.value, o.label]));

export const VALID_GAP_RATINGS = new Set<string>(GAP_RATINGS.map((o) => o.value));

// ── 勤務地 ────────────────────────────────────────────────────────────────────

/**
 * 勤務地の選択肢は既存の定数をそのまま使う。ここで作り直さない。
 *   都道府県   … src/lib/utils/location.ts の PREFECTURES（47値）
 *   勤務形態   … src/lib/constants/workStyle.ts の REMOTE_WORK_STATUSES（3値）
 *
 * ⚠️ `ow_experiences.remote_work_status` は「その在籍期間に本人がどう働いていたか」。
 *    求職者の**希望**（careerPreferences.ts の DESIRED_WORK_STYLES）とは別物。
 */
const VALID_PREFECTURES = new Set<string>(PREFECTURES);

// ── 保存API 共通のホワイトリスト検証 ──────────────────────────────────────────

export type GapInput = { axis: string; rating: string };

/** ow_experiences に書き込む値。undefined の列は触らない。 */
export type ReasonFieldsPatch = {
  prefecture: string | null;
  remote_work_status: string | null;
  join_reasons: string[] | null;
  join_reason_primary: string | null;
  leave_reasons: string[] | null;
};

export type ParseReasonFieldsResult =
  | {
      ok: true;
      patch: ReasonFieldsPatch;
      /** null = リクエストに gaps キーが無い（＝触らない）。[] = 全消し。 */
      gaps: GapInput[] | null;
    }
  | { ok: false; error: string; message: string };

function isBlankish(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/**
 * 文字列配列をホワイトリストで検証する。
 *
 * ⚠️ **不正値を黙って捨てない。** 1つでも知らない値があればエラーを返す。
 *    落とした値を握り潰すと、利用者には「保存できたのに消えている」に見える
 *    （CLAUDE.md「入力させたのに保存しない UI を作らない」）。
 *
 * ⚠️ **上限を超えたときも黙って切らない。** 先頭3つだけ保存すると、
 *    利用者が選んだはずのものが理由なく消える。400 で返して UI に出す。
 */
function parseSlugArray(
  raw: unknown,
  valid: Set<string>,
  fieldLabel: string
): { ok: true; value: string[] | null } | { ok: false; message: string } {
  if (isBlankish(raw)) return { ok: true, value: null };
  if (!Array.isArray(raw)) {
    return { ok: false, message: `${fieldLabel}の形式が不正です。` };
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || !valid.has(v)) {
      return { ok: false, message: `${fieldLabel}に不正な値が含まれています。` };
    }
    // 重複は詰めるだけ。値を失わないのでエラーにしない
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  if (out.length > REASON_MAX) {
    return { ok: false, message: `${fieldLabel}は${REASON_MAX}つまで選べます。` };
  }
  // 空配列は「未回答」と同じ扱いにする。'{}' を保存すると
  // 「選ばなかった」と「答えていない」が集計で区別できなくなる
  return { ok: true, value: out.length > 0 ? out : null };
}

/**
 * POST / PATCH が共通で使う検証。**片方にだけ書かないこと。**
 * 割れると「作成時は保存されるが更新すると消える」が起きる。
 */
export function parseReasonFields(body: Record<string, unknown>): ParseReasonFieldsResult {
  // ── 勤務地
  let prefecture: string | null = null;
  if (!isBlankish(body.prefecture)) {
    const v = body.prefecture;
    if (typeof v !== "string" || !VALID_PREFECTURES.has(v)) {
      return { ok: false, error: "INVALID_PREFECTURE", message: "勤務地（都道府県）の値が不正です。" };
    }
    prefecture = v;
  }

  let remoteWorkStatus: string | null = null;
  if (!isBlankish(body.remote_work_status)) {
    const v = body.remote_work_status;
    if (typeof v !== "string" || !VALID_REMOTE_WORK_STATUSES.has(v)) {
      return { ok: false, error: "INVALID_REMOTE_WORK_STATUS", message: "勤務形態の値が不正です。" };
    }
    remoteWorkStatus = v;
  }

  // ── 入社理由
  const join = parseSlugArray(body.join_reasons, VALID_JOIN_REASONS, "入社理由");
  if (!join.ok) return { ok: false, error: "INVALID_JOIN_REASONS", message: join.message };

  let joinPrimary: string | null = null;
  if (!isBlankish(body.join_reason_primary)) {
    const v = body.join_reason_primary;
    if (typeof v !== "string" || !VALID_JOIN_REASONS.has(v)) {
      return { ok: false, error: "INVALID_JOIN_REASON_PRIMARY", message: "入社の決め手の値が不正です。" };
    }
    /* ⚠️ DB の CHECK（ow_experiences_join_reason_primary_check）と同じ条件。
          ここで弾かないと 23514 になり、利用者には原因の分からない500に見える。 */
    if (!join.value || !join.value.includes(v)) {
      return {
        ok: false,
        error: "JOIN_REASON_PRIMARY_NOT_SELECTED",
        message: "入社の決め手は、選んだ入社理由の中から選んでください。",
      };
    }
    joinPrimary = v;
  }

  // ── 退職理由
  const leave = parseSlugArray(body.leave_reasons, VALID_LEAVE_REASONS, "退職理由");
  if (!leave.ok) return { ok: false, error: "INVALID_LEAVE_REASONS", message: leave.message };

  // ── ギャップ（別テーブル）
  let gaps: GapInput[] | null = null;
  if (body.gaps !== undefined) {
    if (!Array.isArray(body.gaps)) {
      return { ok: false, error: "INVALID_GAPS", message: "入社前後のギャップの形式が不正です。" };
    }
    const seenAxis = new Set<string>();
    const out: GapInput[] = [];
    for (const g of body.gaps) {
      if (typeof g !== "object" || g === null) {
        return { ok: false, error: "INVALID_GAPS", message: "入社前後のギャップの形式が不正です。" };
      }
      const { axis, rating } = g as Record<string, unknown>;
      if (typeof axis !== "string" || !VALID_GAP_AXES.has(axis)) {
        return { ok: false, error: "INVALID_GAP_AXIS", message: "入社前後のギャップの項目が不正です。" };
      }
      if (typeof rating !== "string" || !VALID_GAP_RATINGS.has(rating)) {
        return { ok: false, error: "INVALID_GAP_RATING", message: "入社前後のギャップの回答が不正です。" };
      }
      /* 同じ軸が2回来たら弾く。UNIQUE(experience_id, axis) に当たって
         23505 になる前に、意味の分かるエラーにする。 */
      if (seenAxis.has(axis)) {
        return { ok: false, error: "DUPLICATE_GAP_AXIS", message: "入社前後のギャップに同じ項目が重複しています。" };
      }
      seenAxis.add(axis);
      out.push({ axis, rating });
    }
    gaps = out;
  }

  return {
    ok: true,
    patch: {
      prefecture,
      remote_work_status: remoteWorkStatus,
      join_reasons: join.value,
      join_reason_primary: joinPrimary,
      leave_reasons: leave.value,
    },
    gaps,
  };
}
