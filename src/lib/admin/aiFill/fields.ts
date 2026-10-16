import { COMPANY_REMOTE_WORK_STATUSES } from "@/lib/constants/workStyle";

/**
 * ★運営の「AIで埋める」で扱う項目（2026-10-15 / 柴さんの判断）。**項目の定義はこの1ファイルだけ。**
 *
 * 初回の対象は、掲載企業で空いている3項目だけ（他の項目の上書きは対象外）:
 *   勤務形態（20/21社が空）・福利厚生（20/21社）・事業領域の従（16/21社）
 *
 * ⚠️★勤務時間制度（work_time_system）は 2026-10-16 に外した（柴さんの判断）。企業ページに表示する場所が無く、
 *    「運営がAIで作成した情報です」の印を出せないため。**印を出す場所を作るまで、ここに戻さないこと。**
 *
 * ⚠️ 質問文・読み取り・確認画面・反映の API がすべてここを見る。項目を足すときはこの配列に足す
 * ⚠️ 貼り付けた AI の文章は保存しない（読み取りはブラウザの中だけ。API には値と出典 URL だけを送る）
 */

export type AiFillKind = "enum" | "list" | "text" | "domains";

export type AiFillField = {
  key: AiFillFieldKey;
  label: string;
  kind: AiFillKind;
  /** 質問文で AI に答え方を伝える1文 */
  instruction: string;
};

export const AI_FILL_FIELD_KEYS = ["remote_work_status", "benefits", "business_domains_secondary"] as const;
export type AiFillFieldKey = (typeof AI_FILL_FIELD_KEYS)[number];

export function isAiFillFieldKey(v: unknown): v is AiFillFieldKey {
  return typeof v === "string" && (AI_FILL_FIELD_KEYS as readonly string[]).includes(v);
}

/** 勤務形態の選択肢（★ DB の CHECK と同じ4つ。lib/constants/workStyle.ts のラベルをそのまま使う） */
export const REMOTE_CHOICES = COMPANY_REMOTE_WORK_STATUSES;

export const AI_FILL_FIELDS: readonly AiFillField[] = [
  {
    key: "remote_work_status", label: "勤務形態（リモート）", kind: "enum",
    instruction: `次の選択肢から1つ：${REMOTE_CHOICES.map((c) => c.label).join("／")}`,
  },
  {
    key: "benefits", label: "福利厚生", kind: "list",
    instruction: "制度の名前を「、」で区切って列挙。補足があれば名前のあとに（）で書く（例：フレックスタイム制、書籍購入補助（年5万円まで））",
  },
  {
    key: "business_domains_secondary", label: "事業領域（従）", kind: "domains",
    instruction: "主の事業領域以外に当てはまるものを、下の選択肢から最大2つ「、」で区切って。当てはまらなければ「該当なし」",
  },
];

/** 福利厚生の件数の上限（質問文で大量に返ってきたときに切る。黙って切らず画面に件数を出す） */
export const BENEFITS_MAX = 20;

/** 勤務形態の答え（ラベル or 値）→ DB の値。完全一致だけ（部分一致で当てない） */
export function resolveRemoteChoice(answer: string): string | null {
  const a = answer.trim();
  const hit = REMOTE_CHOICES.find((c) => c.label === a || c.value === a);
  return hit ? hit.value : null;
}

/**
 * ★その会社用の質問文。項目の定義から組み立てる（文面を別に書き写さない）。
 * ⚠️ 形式（`[key] 値 | 出典URL`）を変えるときは parse.ts も一緒に変えること
 */
export function buildAiFillPrompt(p: {
  companyName: string;
  url: string | null;
  primaryDomainName: string | null;
  domainChoices: string[];
}): string {
  const L: string[] = [];
  L.push(`「${p.companyName}」${p.url ? `（公式サイト：${p.url}）` : ""}について、公式サイトなどの公開情報だけを根拠に、次の項目に答えてください。`);
  L.push("各項目には、根拠にしたページの URL を添えてください。");
  L.push("公開情報で確認できない項目は、推測せずに「不明」と答えてください。");
  L.push("選択肢がある項目は、必ず選択肢の中から選んでください。");
  L.push("回答は、次の形式のまま変えずに出力してください（1項目1行）。");
  L.push("");
  for (const f of AI_FILL_FIELDS) L.push(`[${f.key}] 値 | 出典URL`);
  L.push("");
  L.push("項目：");
  for (const f of AI_FILL_FIELDS) L.push(`[${f.key}] ${f.label}：${f.instruction}`);
  L.push("");
  if (p.primaryDomainName) L.push(`この会社の主の事業領域は「${p.primaryDomainName}」です（答えなくてよい）。`);
  L.push(`事業領域の選択肢：${p.domainChoices.join("、")}`);
  return L.join("\n");
}

/** ★「運営がAIで作成・企業未確認」の項目に出す一言（企業ページで同じ文言。判定は lib/companies/operatorCreated.ts）。
    2026-10-16 に「運営が作成した情報です」から直した（柴さんの指示）。⚠️「AI」と「企業は未確認」を落とさないこと */
export const OPERATOR_CREATED_NOTE = "運営がAIで作成した情報です（企業は未確認）";
/** 事業領域のように、一部の値だけが運営の作成のとき。⚠️ OPERATOR_CREATED_NOTE を文字列置換して作らない（括弧の位置が崩れる） */
export const OPERATOR_CREATED_NOTE_PARTIAL = "一部は運営がAIで作成した情報です（企業は未確認）";
