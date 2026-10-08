/**
 * 企業資料（依頼② フェーズ1a / 2026-10-09）の語彙と上限。**ここが唯一の定義。**
 *
 * ⚠️ **UI / API / DB の CHECK の3つを揃える**（CLAUDE.md）。DB 側は
 *    `supabase/migrations/20261009020000_company_materials.sql` の CHECK 制約。
 *    値を足すときは migration も同時に直すこと。片方だけ足すと
 *    「選べるのに保存できない」か「保存できるのに出ない」になる。
 * ⚠️ route の中に `new Set([...])` を書かない。ここの `VALID_*` を使う。
 *
 * ⚠️ このファイルは**クライアントからも import される**（画面の選択肢）。
 *    サーバー専用のもの（admin クライアントなど）をここに置かないこと。
 */

// ── 公開範囲 ────────────────────────────────────────────────────────────────

export const MATERIAL_VISIBILITIES = ["public", "after_mutual", "internal"] as const;
export type MaterialVisibility = (typeof MATERIAL_VISIBILITIES)[number];
export const VALID_MATERIAL_VISIBILITIES: ReadonlySet<string> = new Set(MATERIAL_VISIBILITIES);

export const MATERIAL_VISIBILITY_LABELS: Record<MaterialVisibility, string> = {
  public: "公開",
  after_mutual: "合意後に開示",
  internal: "内部のみ",
};

/**
 * ★その区分で**誰に見えるか**。確定のときに必ず画面に出す（柴さんの指示）。
 * ⚠️ 「合意後に開示」の表示は依頼③で作る。それまで求職者には出ないが、
 *    文言は「確定したらこう扱われる」を書く（③で表示が始まった日に意味が変わらないように）。
 */
export const MATERIAL_VISIBILITY_AUDIENCE: Record<MaterialVisibility, string> = {
  public: "誰でも見られます。求職者向けの企業ページに表示されます（ログインしていない人や検索エンジンも含みます）。",
  after_mutual: "提案で、双方が「会いたい」と答えた求職者だけが見られます。それ以外の求職者には表示されません。",
  internal: "この会社の担当者と、OPINIO のマッチングの処理だけが使います。求職者には一切表示されません。",
};

// ── 区分（カテゴリ）──────────────────────────────────────────────────────────

export const MATERIAL_CATEGORIES = [
  "business", "organization", "workstyle", "benefits",
  "selection", "ideal_candidate", "team_challenges", "other",
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];
export const VALID_MATERIAL_CATEGORIES: ReadonlySet<string> = new Set(MATERIAL_CATEGORIES);

/** ⚠️ 並び順は画面（法人・求職者とも）の表示順。途中に差し込むと既存の並びが動く */
export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  business: "事業",
  organization: "組織",
  workstyle: "働き方",
  benefits: "制度・待遇",
  selection: "選考",
  ideal_candidate: "求める人物像",
  team_challenges: "配属先の課題",
  other: "その他",
};

// ── 資料 ────────────────────────────────────────────────────────────────────

export const MATERIAL_SOURCE_TYPES = ["file", "url"] as const;
export type MaterialSourceType = (typeof MATERIAL_SOURCE_TYPES)[number];

export const MATERIAL_DOCUMENT_STATUSES = ["uploaded", "extracting", "ready", "failed"] as const;
export type MaterialDocumentStatus = (typeof MATERIAL_DOCUMENT_STATUSES)[number];

/**
 * ⚠️★1a では中身を読まないので、ファイルも URL も `uploaded` のまま。
 *    `extracting` / `ready` / `failed` は 1b（AI による項目分け）で使う。
 */
export const MATERIAL_DOCUMENT_STATUS_LABELS: Record<MaterialDocumentStatus, string> = {
  uploaded: "登録済み",
  extracting: "取り出し中",
  ready: "取り出し済み",
  failed: "失敗",
};

/** 10MB。⚠️ DB の CHECK（10485760）と Storage バケットの `file_size_limit` と揃える */
export const MAX_MATERIAL_FILE_BYTES = 10 * 1024 * 1024;

/** Storage のバケット。⚠️ 非公開・クライアント向けのポリシー0本。読み出しは署名 URL だけ */
export const MATERIAL_BUCKET = "company-documents";

/** 署名 URL の有効期間（秒）。⚠️ 短くする。共有されても長く使えないように */
export const MATERIAL_SIGNED_URL_SECONDS = 60;

/**
 * 受け付けるファイル。★**拡張子と MIME の両方**で検査する（柴さんの指示）。
 * ⚠️ `md` はブラウザによって MIME が `text/markdown` / `text/x-markdown` / `text/plain` と割れる。
 *    保存時の Content-Type は `storedMime`（バケットの許可リストと同じ値）に揃える。
 */
export const MATERIAL_FILE_TYPES: Record<string, { mimes: readonly string[]; storedMime: string; label: string }> = {
  pdf:  { mimes: ["application/pdf"], storedMime: "application/pdf", label: "PDF" },
  docx: {
    mimes: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    storedMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word",
  },
  pptx: {
    mimes: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    storedMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    label: "PowerPoint",
  },
  txt:  { mimes: ["text/plain"], storedMime: "text/plain", label: "テキスト" },
  md:   { mimes: ["text/markdown", "text/x-markdown", "text/plain"], storedMime: "text/markdown", label: "Markdown" },
};

export const MATERIAL_FILE_ACCEPT = Object.keys(MATERIAL_FILE_TYPES).map((e) => `.${e}`).join(",");

/** 拡張子と MIME を検査して、保存に使う MIME を返す。合わなければ null */
export function resolveMaterialFileType(fileName: string, mime: string): { ext: string; storedMime: string } | null {
  const m = fileName.match(/\.([A-Za-z0-9]+)$/);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  const t = MATERIAL_FILE_TYPES[ext];
  if (!t) return null;
  if (!t.mimes.includes(mime.toLowerCase())) return null;
  return { ext, storedMime: t.storedMime };
}

/** URL は http / https だけ。⚠️ 1a では**中身を取りに行かない**（リンクとして保存するだけ） */
export function isAllowedMaterialUrl(raw: string): boolean {
  if (/\s/.test(raw)) return false;
  try {
    const u = new URL(raw);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

// ── 上限 ────────────────────────────────────────────────────────────────────

/** ⚠️ DB の CHECK と揃える */
export const MATERIAL_TITLE_MAX = 200;
export const MATERIAL_CONTENT_MAX = 2000;
export const MATERIAL_RESTRICTED_REASON_MAX = 500;
