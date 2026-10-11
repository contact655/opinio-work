/**
 * ★求人の禁止表現の自動チェック（2026-10-12 / 柴さんの指示）。**判定はここの1か所。純粋関数。**
 *   ブラウザ（作成・編集画面）とサーバー（公開の判定・運営画面）が同じ関数を呼ぶ。
 *
 *   観点: 年齢制限 ／ 性別限定（性別を示す職種名を含む）／ 国籍限定 ／ 違法・不審な求人
 *   ★引っかかったら**公開をブロックする**（2026-10-12 に変更 / 柴さんの判断。それまでは「運営確認中」に回していた）。
 *     必要な項目の不足と同じ扱いで、「公開まであと〇項目」に数え、該当する入力欄へ移動できる。
 *     文言は wordingMessage（「『営業マン』は使えません。『営業担当』などに言い換えると公開できます」）。
 *   ⚠️ 法律で認められた年齢制限の例外などで、どうしても必要な場合は運営へ相談してもらう（画面に出す）。
 *
 * ★**言葉のリストは 2026-10-12 に柴さんが確定した**（`WORDING_LIST_CONFIRMED = true`。本番でも有効）。
 *    false に戻すと本番（NODE_ENV = production）では何も検出しなくなる（ローカルの dev では動く）。
 * ⚠️★**英字の語は前後が英字のときに当てない**（TOOL・SOLUTION・CONTROL の中の「OL」で誤検知しないため）。
 *    `normalize` は英字どうしの間の空白を1つ残すので、「Excel OL」は語の境目として扱える。
 *    英字の語を足すときは `(?<![A-Za-z])語(?![A-Za-z])` の形にし、wordingCheck.test.mjs に誤検知の例も足すこと。
 * ⚠️ DB や server-only のものを import しないこと（ブラウザからも読む）。
 * ⚠️ 17項目の判定（publishRequirements.ts）とは分けてある。両方を呼ぶのは publishGate.ts の1か所。
 */

export const WORDING_LIST_CONFIRMED = true;

export type WordingCategory = "age" | "gender" | "nationality" | "suspicious";
export const WORDING_CATEGORY_LABELS: Record<WordingCategory, string> = {
  age: "年齢の制限",
  gender: "性別の限定",
  nationality: "国籍の限定",
  suspicious: "違法・不審な求人のおそれ",
};

type Rule = {
  category: WordingCategory;
  pattern: RegExp;
  example: string;
  /** ★同じ文がメンバーの説明（MEMBER_CONTEXT）なら当てない。⚠️ 年齢の「範囲」だけに付ける */
  memberContextExempt?: boolean;
};

/* ★年齢の範囲の扱い（2026-10-12 / 柴さんの指示）
   - 「20代〜30代」「25歳〜35歳」「20代から30代まで」のような範囲は、原則として当てる（「20代〜30代の方を募集」をすり抜けさせない）
   - ただし同じ文にメンバーの説明を示す語（MEMBER_CONTEXT）があれば当てない（「20代から50代まで幅広く活躍しています」）
   - ⚠️ その文に募集・限定を示す語（RECRUIT_CONTEXT）もあれば、説明の語があっても当てる（抜け道にしないため）
   - ⚠️ 単独の「30代まで」「35歳まで」は範囲の後ろ側（から・〜 の直後）を除く。範囲は範囲のルールが拾うので二重にしない
   ⚠️ 区切りに長音「ー」を入れない（「リーダー30代まで」の「ー」が範囲に見える）
   ⚠️ 「社員」「メンバー」は説明の語に入れない（「20代〜30代の正社員」が抜ける） */
const MEMBER_CONTEXT = /活躍|在籍|平均年齢|年齢層|年齢構成|年代構成|幅広/;
const RECRUIT_CONTEXT = /募集|の方|限定|のみ|求む|歓迎|に限る/;
const RANGE_SEP = "(?:から|〜|~|-|－)";

/* ★案。正規化（全角半角・空白の除去）したあとの文字列に当てる */
export const WORDING_RULES: readonly Rule[] = [
  // ── 年齢 ──
  { category: "age", pattern: /(?<!(から|〜|~|-|－))(\d{2}|[二三四五六]十)歳(まで|以下|未満|迄|前後|くらい|位|程度)/, example: "35歳まで／30歳以下／40歳前後" },
  /* ⚠️ 範囲の後ろ側（から・〜 の直後）は除く。範囲は下の2本が拾う */
  { category: "age", pattern: /(?<!(から|〜|~|-|－))[1-6]0代(のみ|限定|まで|中心|歓迎|の方)/, example: "20代のみ／30代まで／20代歓迎" },
  { category: "age", pattern: new RegExp(`[1-6]0代?${RANGE_SEP}[1-6]0代`), example: "20代〜30代／20〜30代／20代から30代まで", memberContextExempt: true },
  { category: "age", pattern: new RegExp(`(\\d{2}|[二三四五六]十)歳?${RANGE_SEP}(\\d{2}|[二三四五六]十)歳`), example: "25歳〜35歳／25〜35歳", memberContextExempt: true },
  { category: "age", pattern: /(若手|若年層|若い方)(のみ|限定)/, example: "若手のみ／若年層限定" },
  { category: "age", pattern: /年齢制限(あり|有り|有)/, example: "年齢制限あり" },
  // ── 性別 ──
  { category: "gender", pattern: /(男性|女性|男子|女子)(のみ|限定|歓迎|募集|に限る)/, example: "男性のみ／女性限定／女性歓迎" },
  { category: "gender", pattern: /営業マン|セールスマン|ビジネスマン|サラリーマン|ウェイター|ウェイトレス|看護婦|保母|スチュワーデス/, example: "営業マン／ウェイトレス" },
  /* ⚠️ 英字の語は前後が英字なら当てない（TOOL / SOLUTION / CONTROL）。小文字の ol も当てない */
  { category: "gender", pattern: /(?<![A-Za-z])OL(?![A-Za-z])/, example: "OL" },
  // ── 国籍 ──
  { category: "nationality", pattern: /(日本人|日本国籍(の方)?)(のみ|限定|に限る)/, example: "日本人のみ／日本国籍限定" },
  { category: "nationality", pattern: /(外国人|外国籍)(不可|お断り|NG)/, example: "外国人不可／外国籍NG" },
  // ── 違法・不審 ──
  { category: "suspicious", pattern: /荷物の?(受け取り|受取|受け渡し)/, example: "荷物の受け取り" },
  { category: "suspicious", pattern: /受け子|出し子|闇バイト|裏バイト|ホワイト案件/, example: "受け子／闇バイト" },
  { category: "suspicious", pattern: /即日.{0,6}(高額|高収入)|(高額|高収入).{0,6}即日/, example: "即日高額報酬" },
  { category: "suspicious", pattern: /日給([5-9]|\d{2,})万/, example: "日給10万" },
  { category: "suspicious", pattern: /口座(の)?(貸し出し|売買|譲渡|買取)|携帯(電話)?の?契約代行|スマホの?契約代行/, example: "口座の貸し出し／携帯の契約代行" },
];

export type WordingHit = {
  category: WordingCategory;
  /** 実際に当たった文字列（正規化後） */
  match: string;
  /** どの欄で当たったか（画面に出す名前） */
  field: string;
};

/** 全角英数→半角・空白（全角を含む）の除去。⚠️ 当たった文字列もこの形で返る
 *  ⚠️ 英字どうしの間の空白だけは1つ残す。消すと「Excel OL」が「ExcelOL」になり、英字の語の境目が消える */
export function normalize(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, (m, off: number, str: string) =>
    /[A-Za-z]/.test(str[off - 1] ?? "") && /[A-Za-z]/.test(str[off + m.length] ?? "") ? " " : "");
}

function active(): boolean {
  return WORDING_LIST_CONFIRMED || process.env.NODE_ENV !== "production";
}

/** ★検出。同じ欄・同じ表現は1回だけ返す */
export function checkWording(fields: { field: string; text: string | null | undefined }[]): WordingHit[] {
  if (!active()) return [];
  const out: WordingHit[] = [];
  const seen = new Set<string>();
  for (const f of fields) {
    if (!f.text) continue;
    /* ★文ごとに当てる（メンバーの説明かどうかを文単位で見るため）。⚠️ 正規化で改行が消えるので、分けてから正規化する */
    for (const sentence of f.text.split(/[。．！？!?\n]/)) {
     const t = normalize(sentence);
     if (!t) continue;
     const memberOnly = MEMBER_CONTEXT.test(t) && !RECRUIT_CONTEXT.test(t);
     for (const r of WORDING_RULES) {
      if (r.memberContextExempt && memberOnly) continue;
      const g = new RegExp(r.pattern.source, "g");
      for (const m of Array.from(t.matchAll(g))) {
        const k = `${f.field}|${m[0]}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ category: r.category, match: m[0], field: f.field });
      }
     }
    }
  }
  return out;
}

/** 検査する欄（DB の行から）。⚠️ 欄を足すときは `wordingFieldsFromForm`・`WORDING_COLUMNS`・`WORDING_FIELD_TARGETS` も足す
 *  ⚠️★**企業が直せない欄を入れないこと**（2026-10-12）。公開をブロックするので、入力欄の無い欄に当たると永久に公開できない。
 *     「求める人物像」（culture_fit）は 2026-10-11 に入力欄を外したので、ここからも外した */
export const WORDING_COLUMNS = "title, description, message_to_candidates, required_skills, preferred_skills, salary_note, location, work_hours, holidays" as const;

const joinList = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : typeof v === "string" ? v : null);

export function wordingFieldsFromRow(row: Record<string, unknown>): { field: string; text: string | null }[] {
  return [
    { field: "求人タイトル", text: (row.title as string | null) ?? null },
    { field: "仕事内容", text: (row.description as string | null) ?? null },
    { field: "候補者へのメッセージ", text: (row.message_to_candidates as string | null) ?? null },
    { field: "必須スキル", text: joinList(row.required_skills) },
    { field: "歓迎スキル", text: joinList(row.preferred_skills) },
    { field: "給与の補足", text: (row.salary_note as string | null) ?? null },
    { field: "勤務地", text: (row.location as string | null) ?? null },
    { field: "勤務時間", text: (row.work_hours as string | null) ?? null },
    { field: "休日・休暇", text: (row.holidays as string | null) ?? null },
  ];
}

export function wordingFieldsFromForm(form: {
  title?: string; descriptionMarkdown?: string; messageToCandidates?: string; requiredSkills?: string[]; preferredSkills?: string[];
  salaryNote?: string; location?: string; workHours?: string | null; holidays?: string | null;
}): { field: string; text: string | null }[] {
  return wordingFieldsFromRow({
    title: form.title, description: form.descriptionMarkdown, message_to_candidates: form.messageToCandidates,
    required_skills: form.requiredSkills, preferred_skills: form.preferredSkills,
    salary_note: form.salaryNote, location: form.location, work_hours: form.workHours, holidays: form.holidays,
  });
}

/* ── ★公開をブロックしたときの案内（2026-10-12）──────────────────────────── */

/** 言い換えの例。⚠️ 当たった語に対して1つ。無いものはカテゴリごとの文にする */
const REPLACEMENTS: readonly [RegExp, string][] = [
  [/^(営業マン|セールスマン)$/, "営業担当"],
  [/^ビジネスマン$/, "ビジネスパーソン"],
  [/^サラリーマン$/, "会社員"],
  [/^(ウェイター|ウェイトレス)$/, "ホールスタッフ"],
  [/^看護婦$/, "看護師"],
  [/^保母$/, "保育士"],
  [/^スチュワーデス$/, "客室乗務員"],
  [/^OL$/, "事務職"],
];

/** ★企業に見せる文。「『営業マン』は使えません。『営業担当』などに言い換えると公開できます」 */
export function wordingMessage(hit: Pick<WordingHit, "category" | "match">): string {
  const rep = REPLACEMENTS.find(([re]) => re.test(hit.match))?.[1];
  if (rep) return `「${hit.match}」は使えません。「${rep}」などに言い換えると公開できます。`;
  switch (hit.category) {
    case "age": return `「${hit.match}」のような年齢の条件は書けません。経験やスキルで書くと公開できます。`;
    case "gender": return `「${hit.match}」のような性別の条件は書けません。性別を問わない書き方にすると公開できます。`;
    case "nationality": return `「${hit.match}」のような国籍の条件は書けません。必要な語学力などで書くと公開できます。`;
    default: return `「${hit.match}」は不審な求人と受け取られるおそれがあるため使えません。言い換えるか削除すると公開できます。`;
  }
}

/** ★当たった欄 → 編集画面のどのステップのどの入力欄か（「公開まであと〇項目」から移動する先）。
 *  ⚠️ JobEditForm の入力欄の id と揃える。ステップ名は publishRequirements.ts の JobEditStep */
export const WORDING_FIELD_TARGETS: Record<string, { step: "job" | "conditions" | "requirements" | "more"; fieldId: string }> = {
  "求人タイトル": { step: "job", fieldId: "jef-title" },
  "仕事内容": { step: "job", fieldId: "jef-description" },
  "候補者へのメッセージ": { step: "more", fieldId: "jef-message-to-candidates" },
  "必須スキル": { step: "requirements", fieldId: "jef-required-skills" },
  "歓迎スキル": { step: "requirements", fieldId: "jef-preferred-skills" },
  "給与の補足": { step: "conditions", fieldId: "jef-salary-note" },
  "勤務地": { step: "conditions", fieldId: "jef-location" },
  "勤務時間": { step: "conditions", fieldId: "jef-work-hours" },
  "休日・休暇": { step: "conditions", fieldId: "jef-holidays" },
};
