/**
 * ★会社紹介資料（採用ピッチ資料）のリンク（2026-11-28 / 柴さんの指示）。
 *   保存先は ow_company_external_links（type = 'deck'）。1社3件まで・タイトルと https の URL が必須。
 *   /biz/company の入力・「変更を公開する」の保存・企業ページの表示が同じ規則を使う。**書き写さないこと。**
 *
 * ⚠️ 外部のページを埋め込まない（iframe にしない）。リンクのカードだけ。
 * ⚠️ 何も import しない（クライアントからも読む。npm test が直接読む）。
 */

export const DECKS_MAX = 3;
export const DECK_TITLE_MAX = 100;

export type Deck = { title: string; url: string };
export type DeckInput = { title: string; url: string };

/** 下書き（draft_data）に入れるキー */
export const DRAFT_DECKS_KEY = "decks";

export function parseDecks(raw: unknown): { ok: true; items: Deck[] } | { ok: false; error: string } {
  if (raw === null || raw === undefined) return { ok: true, items: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "会社紹介資料の形が正しくありません" };
  const items: Deck[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return { ok: false, error: "会社紹介資料の形が正しくありません" };
    const o = r as Record<string, unknown>;
    const title = String(o.title ?? "").trim();
    const urlStr = String(o.url ?? "").trim();
    if (!title && !urlStr) continue;
    if (!title) return { ok: false, error: "会社紹介資料のタイトルを入れてください" };
    if (title.length > DECK_TITLE_MAX) return { ok: false, error: `会社紹介資料のタイトルは${DECK_TITLE_MAX}字までです` };
    let url: string;
    try {
      const u = new URL(urlStr);
      if (u.protocol !== "https:" || urlStr.length > 2000) throw new Error("not https");
      url = u.href;
    } catch {
      return { ok: false, error: "会社紹介資料の URL は https:// で始まる URL を入れてください" };
    }
    items.push({ title, url });
  }
  if (items.length > DECKS_MAX) return { ok: false, error: `会社紹介資料は${DECKS_MAX}件までです` };
  return { ok: true, items };
}

/** カードに出すドメイン名（www. は外す） */
export function deckDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}
