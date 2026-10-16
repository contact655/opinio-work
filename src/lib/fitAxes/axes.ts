/**
 * ★「相性のものさし」の軸（第1版。2026-10-15 / 柴さんが確定）。**軸の定義はこの1ファイルだけ。**
 *
 * - 軸を差し替えるときは `FIT_AXES_VERSION` を上げる。保存した回答は回答時点の版を持つ（`ow_fit_axis_answers.axes_version`）
 * - DB は `axis_key` を CHECK しない（軸が変わるたびに migration を要らなくするため）。**受け付けるのは API がここの key だけ**
 * - 1〜5 の両極。1 が左（`left`）、5 が右（`right`）。「わからない」は値なし（null）
 *
 * ⚠️ このファイルは import を持たない（クライアントの画面からも、node --test からも読むため）。
 */

export const FIT_AXES_VERSION = 1;

export type FitAxis = {
  key: string;
  name: string;
  /** 1 の側 */
  left: string;
  /** 5 の側 */
  right: string;
};

export const FIT_AXES: readonly FitAxis[] = [
  { key: "work_style", name: "仕事の進め方", left: "自分で考えて動く", right: "型や仕組みに沿って動く" },
  { key: "phase", name: "会社のフェーズ", left: "整っていない環境を楽しめる", right: "整った環境で力を出す" },
  { key: "result", name: "成果の出し方", left: "個人で追う", right: "チームで追う" },
  { key: "decision", name: "意思決定", left: "スピード重視", right: "合意形成を重視" },
  { key: "customer", name: "顧客との距離", left: "現場で顧客と向き合う", right: "戦略・企画の側から関わる" },
  { key: "growth", name: "キャリアの広げ方", left: "幅を広げたい", right: "専門を深めたい" },
] as const;

export const FIT_AXIS_KEYS: readonly string[] = FIT_AXES.map((a) => a.key);

export function isFitAxisKey(v: unknown): v is string {
  return typeof v === "string" && FIT_AXIS_KEYS.includes(v);
}

/** 1つの軸の値。null は「わからない」 */
export type FitAxisValue = 1 | 2 | 3 | 4 | 5 | null;

export function isFitAxisValue(v: unknown): v is FitAxisValue {
  return v === null || v === 1 || v === 2 || v === 3 || v === 4 || v === 5;
}

/** 入力元。⚠️ DB の CHECK（ow_fit_axis_answers_source_check）と同じ2つ */
export const FIT_AXIS_SOURCES = ["ai_paste", "manual"] as const;
export type FitAxisSource = (typeof FIT_AXIS_SOURCES)[number];

export function isFitAxisSource(v: unknown): v is FitAxisSource {
  return typeof v === "string" && (FIT_AXIS_SOURCES as readonly string[]).includes(v);
}

/**
 * ★本番での公開スイッチ。**表示の切り替えはこの1か所だけ**（2026-10-15 / 柴さんの判断）。
 *   false のあいだは、検証用アカウント（is_test）にだけ入口・ページ・保存を開く。
 *   ⚠️ true にするのは**プライバシーポリシーの改定と同時**（文案は docs/pending/privacy-20261015-相性のものさし.md）。
 */
export const FIT_AXES_PUBLIC = false;

/** この人に「相性のものさし」を見せてよいか（入口・ページ・API が同じ関数を見る） */
export function fitAxesEnabledFor(viewer: { isTest: boolean }): boolean {
  return FIT_AXES_PUBLIC || viewer.isTest;
}

/**
 * ★自分の AI に貼る質問文。**軸の定義から組み立てる**（文面を別に書き写さない）。
 * ⚠️ 回答の形式（`[key] 数字: 理由`）を変えるときは parse.ts の読み取りも一緒に変えること
 */
export function buildFitAxesPrompt(): string {
  const lines: string[] = [];
  lines.push("あなたがこれまでの会話で知っている私の経歴・考え方・価値観をもとに、次の質問に答えてください。");
  lines.push("各項目は 1〜5 の数字で答え、1行で理由を添えてください。");
  lines.push("私について十分な情報が無い項目は、推測せずに「わからない」と答えてください。");
  lines.push("回答は、次の形式のまま変えずに出力してください。");
  lines.push("");
  for (const a of FIT_AXES) lines.push(`[${a.key}] 数字: 理由`);
  lines.push("");
  lines.push("質問：");
  for (const a of FIT_AXES) {
    lines.push(`[${a.key}] ${a.name}：1＝${a.left}、5＝${a.right}。私はどちらに近いですか？`);
  }
  return lines.join("\n");
}
