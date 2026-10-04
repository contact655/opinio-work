import { LINE_ADD_FRIEND_URL } from "./line";

/**
 * 社長図鑑（/zukan）の定数。
 *
 * ⚠️ 導線の URL は `lib/constants/line.ts`（Opinio Agent の公式LINE）を参照する。
 *    **ここに URL を直書きしないこと**（二重に持たない）。
 *
 * ⚠️★導線は「Opinio Agent（人材紹介）」へのもので、**OPINIO 本体（募集情報等提供）ではない。**
 *    そのため導線の近くに `ZUKAN_AGENT_NOTE` と許可番号を必ず添える（2026-10-04 / 柴さんの判断）。
 *    ⚠️ 許可番号は `content/legal/legal-agency.md` と同じ値。変えるときは**あちらを先に直す**。
 */
export const ZUKAN_LINE_URL = LINE_ADD_FRIEND_URL;

/**
 * 導線の見出し。本文の途中には置かない（末尾の1か所だけ）。
 * ⚠️ 2つに分けて持つのは**折り返し位置を決めるため**（2026-10-04 / 柴さんの指示）。
 *    狭い画面では「この会社・この社長の話を」の後で改行し、広い画面では1行で出す。
 *    1つの文字列に戻すと、375px で「聞いてみた／い方へ」と語の途中で切れる。
 */
export const ZUKAN_CTA_HEADING_LINES = ["この会社・この社長の話を", "聞いてみたい方へ"] as const;

/** 導線のすぐ下に出す、OPINIO 本体との違いを示す一文 */
export const ZUKAN_AGENT_NOTE = "Opinio Agent（株式会社Opinio の人材紹介サービス）へのご相談です。";

export const ZUKAN_AGENT_LICENSE = "有料職業紹介事業 許可番号 13-ユ-316441";

export const ZUKAN_TITLE = "社長図鑑";
export const ZUKAN_LEAD = "採用の現場を見てきたエージェントが、第三者の目線で社長を紹介する図鑑です。";

/**
 * 図鑑ページの鮮度。⚠️ 記事そのものはビルド時に固まる（.md はデプロイでしか変わらない）。
 *    この値が効くのは**企業ページへのリンクを張るか**（`is_published`）の判定だけ。
 */
export const ZUKAN_REVALIDATE_SECONDS = 3600;
