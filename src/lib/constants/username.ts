/**
 * プロフィールURL（`/u/<username>`）に使うユーザー名の規則（2026-08-23 確立）。
 *
 * ── 決めたこと ──────────────────────────────────────────────────────────────
 *
 * ⚠️ **生年月日・年齢を URL に入れない。** 入れさせる形にもしない。
 *    URL は共有され、サーバーログ・Referer・アクセス解析・ブラウザ履歴・
 *    チャットのリンクプレビューに残る。**一度入れると後から回収できない。**
 *    Opinio は「年齢は詳細ページだけ・一覧に出さない・年齢で絞り込ませない」と
 *    決めており（労働施策総合推進法9条。CLAUDE.md 参照）、URL に生年月日を置くのは
 *    その方針を正面から壊す。
 *    ⚠️ 他社に `yuei_0119` のような「名前＋誕生日」の実例があるが、**真似しない。**
 *       あれは利用者が自分で選んだ結果であって、設計として勧めるものではない。
 *
 * ⚠️ **本名から自動生成しない。** 日本語名のローマ字化は一意に決まらず
 *    （斉藤／齋藤、ゆうき＝yuki/yuuki/yūki）、機械が選ぶと必ず外す。
 *    それ以前に、**本名を URL に固定すると本人が変えられない**。
 *    未設定のうちは UUID のままにして、**本人が決めたときだけ** username を持つ。
 *
 * ⚠️ **設定は任意。** 未設定でも `/u/<uuid>` で見られる（既存の解決処理のまま）。
 *
 * ── 形式 ────────────────────────────────────────────────────────────────────
 *   - 使える文字は `a-z` `0-9` `_` のみ（小文字だけ）
 *   - **先頭は英字**
 *   - 3〜30文字
 *
 * ⚠️ **ハイフンを許さないのは意図的。** UUID（`0c99e403-7540-…`）にはハイフンが
 *    入るので、ハイフンを禁じておくと **username と UUID の名前空間が絶対に衝突しない。**
 *    `/u/[id]` は両方を受けるため、この性質に依存している。
 *
 * ⚠️ **先頭を英字に限るのも意図的。** 既存の username は UUID の先頭8桁
 *    （`0c99e403` など）が入っており、数字始まりを禁じると
 *    **新しく「UUID の断片に見える username」を作れなくなる。**
 *
 * ⚠️ 既存の12件はこの形式を満たさない（数字始まりがある）。
 *    そのため DB の CHECK は **NOT VALID** で入れてある。
 *    既存行はそのまま動き、**新しく入れる値・更新する値だけ**が検証される。
 *    既存値を機械的に書き換えないこと（共有済みのURLが死ぬ）。
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;

/** DB の CHECK と**同じ式**にすること（migration 側にも同じ正規表現を書いてある） */
export const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,29}$/;

/**
 * 使えない名前。
 *
 * ⚠️ **これは DB の CHECK に入れていない。** ルートが増えるたびに migration を
 *    書く運用になるのを避けるため。書き込む経路は
 *    `PUT /api/jobseeker/profile` だけなので、そこで弾けば足りる。
 * ⚠️ 新しい公開ルートを足したら、ここにも足すこと。
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // ルート名（/u/<username> と紛れるもの・将来ぶつかりうるもの）
  "u", "users", "user", "me", "profile", "profiles", "mypage", "settings", "account",
  "companies", "company", "jobs", "job", "people", "feed", "articles", "article",
  "search", "salary", "schools", "school", "biz", "admin", "api", "auth", "login",
  "logout", "signup", "signin", "onboarding", "contact", "terms", "privacy", "legal",
  "business", "careers", "notifications", "messages", "scouts", "bookmarks",
  // 運営・なりすまし対策
  "opinio", "official", "support", "help", "staff", "team", "info", "root", "system",
  // 事故りやすい値
  "null", "undefined", "true", "false", "new", "edit", "delete", "create",
]);

export type UsernameError =
  | "FORMAT"      // 文字種・長さ・先頭が英字でない
  | "RESERVED"    // 予約語
  ;

/**
 * 入力を正規化する。**前後の空白を落として小文字にするだけ。**
 * ⚠️ 全角→半角のような「直してあげる」変換はしない。
 *    入力と保存値がずれると、本人が何を登録したか分からなくなる。
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** 正規化済みの値を検証する。問題なければ null */
export function validateUsername(normalized: string): UsernameError | null {
  if (!USERNAME_PATTERN.test(normalized)) return "FORMAT";
  if (RESERVED_USERNAMES.has(normalized)) return "RESERVED";
  return null;
}

/** 画面に出す文言。API と UI で同じものを使う */
export const USERNAME_ERROR_MESSAGE: Record<UsernameError | "TAKEN", string> = {
  FORMAT:
    `英字で始まる ${USERNAME_MIN}〜${USERNAME_MAX} 文字で、小文字の英数字と _ だけが使えます。`,
  RESERVED: "この文字列は使えません。別のものを入力してください。",
  TAKEN: "この文字列はすでに使われています。別のものを入力してください。",
};

/** 入力欄の下に出す説明。⚠️ 生年月日を勧める文言にしないこと */
export const USERNAME_HINT =
  "プロフィールのURLになります。あとから変更できますが、変更すると以前のURLは開けなくなります。";
