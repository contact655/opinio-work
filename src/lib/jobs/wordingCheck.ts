/**
 * ★求人の禁止表現の自動チェック（2026-10-12 / 柴さんの指示）。**判定はここの1か所。純粋関数。**
 *   ブラウザ（作成・編集画面）とサーバー（公開の判定・運営画面）が同じ関数を呼ぶ。
 *
 *   観点: 年齢制限 ／ 性別限定（性別を示す職種名を含む）／ 国籍限定 ／ 違法・不審な求人
 *   引っかかったら公開せず「運営確認中」（pending_review）にする。どの表現が該当したかを企業に出す。
 *   ⚠️ 「拒否」ではない。運営が見て問題なければ公開する（例: 法律で認められた年齢制限の例外）。
 *
 * ⚠️★**言葉のリストは案**（柴さんが確定するまで本番に出さない）。`WORDING_LIST_CONFIRMED` が false のあいだは
 *    **本番（NODE_ENV = production）では何も検出しない**。ローカルの dev では動く（検証用）。
 *    確定したら true にする。⚠️ NODE_ENV はビルドで置き換わるので、ブラウザ側でも同じ判定になる。
 * ⚠️ DB や server-only のものを import しないこと（ブラウザからも読む）。
 * ⚠️ 17項目の判定（publishRequirements.ts）とは分けてある。両方を呼ぶのは publishGate.ts の1か所。
 */

export const WORDING_LIST_CONFIRMED = false;

export type WordingCategory = "age" | "gender" | "nationality" | "suspicious";
export const WORDING_CATEGORY_LABELS: Record<WordingCategory, string> = {
  age: "年齢の制限",
  gender: "性別の限定",
  nationality: "国籍の限定",
  suspicious: "違法・不審な求人のおそれ",
};

type Rule = { category: WordingCategory; pattern: RegExp; example: string };

/* ★案。正規化（全角半角・空白の除去）したあとの文字列に当てる */
export const WORDING_RULES: readonly Rule[] = [
  // ── 年齢 ──
  { category: "age", pattern: /(\d{2}|[二三四五六]十)歳(まで|以下|未満|迄|前後|くらい|位|程度)/, example: "35歳まで／30歳以下／40歳前後" },
  { category: "age", pattern: /[1-6]0代(のみ|限定|まで|中心|歓迎|の方)/, example: "20代のみ／30代まで／20代歓迎" },
  { category: "age", pattern: /(若手|若年層|若い方)(のみ|限定)/, example: "若手のみ／若年層限定" },
  { category: "age", pattern: /年齢制限(あり|有り|有)/, example: "年齢制限あり" },
  // ── 性別 ──
  { category: "gender", pattern: /(男性|女性|男子|女子)(のみ|限定|歓迎|募集|に限る)/, example: "男性のみ／女性限定／女性歓迎" },
  { category: "gender", pattern: /営業マン|セールスマン|ビジネスマン|サラリーマン|ウェイター|ウェイトレス|看護婦|保母|スチュワーデス|(?<![A-Za-z])OL(?![A-Za-z])/, example: "営業マン／ウェイトレス／OL" },
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

/** 全角英数→半角・空白（全角を含む）の除去。⚠️ 当たった文字列もこの形で返る */
function normalize(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, "");
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
    const t = normalize(f.text);
    for (const r of WORDING_RULES) {
      const g = new RegExp(r.pattern.source, "g");
      for (const m of Array.from(t.matchAll(g))) {
        const k = `${f.field}|${m[0]}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ category: r.category, match: m[0], field: f.field });
      }
    }
  }
  return out;
}

/** 検査する欄（DB の行から）。⚠️ 欄を足すときは `wordingFieldsFromForm` と `WORDING_COLUMNS` も足す */
export const WORDING_COLUMNS = "title, description, message_to_candidates, required_skills, preferred_skills, culture_fit, salary_note, location, work_hours, holidays" as const;

const joinList = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").join("\n") : typeof v === "string" ? v : null);

export function wordingFieldsFromRow(row: Record<string, unknown>): { field: string; text: string | null }[] {
  return [
    { field: "求人タイトル", text: (row.title as string | null) ?? null },
    { field: "仕事内容", text: (row.description as string | null) ?? null },
    { field: "候補者へのメッセージ", text: (row.message_to_candidates as string | null) ?? null },
    { field: "必須スキル", text: joinList(row.required_skills) },
    { field: "歓迎スキル", text: joinList(row.preferred_skills) },
    { field: "求める人物像", text: (row.culture_fit as string | null) ?? null },
    { field: "給与の補足", text: (row.salary_note as string | null) ?? null },
    { field: "勤務地", text: (row.location as string | null) ?? null },
    { field: "勤務時間", text: (row.work_hours as string | null) ?? null },
    { field: "休日・休暇", text: (row.holidays as string | null) ?? null },
  ];
}

export function wordingFieldsFromForm(form: {
  title?: string; descriptionMarkdown?: string; messageToCandidates?: string; requiredSkills?: string[]; preferredSkills?: string[];
  cultureFit?: string; salaryNote?: string; location?: string; workHours?: string | null; holidays?: string | null;
}): { field: string; text: string | null }[] {
  return wordingFieldsFromRow({
    title: form.title, description: form.descriptionMarkdown, message_to_candidates: form.messageToCandidates,
    required_skills: form.requiredSkills, preferred_skills: form.preferredSkills, culture_fit: form.cultureFit,
    salary_note: form.salaryNote, location: form.location, work_hours: form.workHours, holidays: form.holidays,
  });
}
