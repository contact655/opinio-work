/**
 * リクエストの text 項目の正規化。
 *
 * ── なぜ1箇所に置くか（2026-08-15 確立）────────────────────────────────────
 * 同じ「空入力」の扱いが API ごとに3通りに割れていた。
 *
 * | API | 空文字の扱い |
 * |---|---|
 * | `profile` | **`""` のまま保存**（`location` / `about_me` 等） |
 * | `educations` / `content-links` | `trim()` だけ。`\|\| null` が無く `""` が入りうる |
 * | `achievements` / `awards` / `media-appearances` | `trim() \|\| null`（正しい） |
 *
 * 結果、`ow_users.about_me` に `''` の行が生まれ、`count(about_me)` のような
 * 充填率の集計が「入力済み」と数えてしまう（表示側は truthy 判定なので画面は無事だった）。
 *
 * ⚠️ **「空」は正常系、「不正」は異常系。この2つを混同しない。**
 *    空 → `null`（任意項目）か 400（必須項目）。不正 → 400。**黙って捨てない。**
 *
 * ⚠️ **フラグ付きの1本にしない。** `optionalText(v, { required: true })` の形にすると、
 *    呼び出し側が真偽値を読み違えたときに気づけない。**必須と任意で関数を分ける。**
 *
 * ⚠️ **利用者に見せる文言に列名を出さない。** 画面に出るのは
 *    「お名前を入力してください」の側で、列名はサーバーログに出す。
 */

/**
 * 400 を返すための例外。ルート側で1回だけ catch する
 * （項目ごとに `if (!ok) return NextResponse...` を書き足さないため）。
 */
export class InvalidInputError extends Error {
  /** 利用者に見せる文言。⚠️ 列名を入れない */
  readonly userMessage: string;
  /** サーバーログ用。列名はこちらに入れる */
  readonly field: string;

  constructor(field: string, userMessage: string) {
    super(`invalid input: ${field}`);
    this.name = "InvalidInputError";
    this.field = field;
    this.userMessage = userMessage;
  }
}

/**
 * 任意の text。**空は正常系なので `null` にする。**
 *
 * - 文字列でない（undefined / null / 数値など） → `null`
 * - trim して空 → `null`
 * - 上限超過 → `max` で切る（任意項目は切っても入力の意図を壊さない）
 */
export function optionalText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

/**
 * 必須の text。**空は 400。黙って null にしない。**
 *
 * ⚠️ 呼ぶ前に「ペイロードにキーが有るか」を判定すること。
 *    **未送信と空送信を同一視しない。** 未送信は「変更なし」であって空ではない。
 *
 * @param field        列名。ログにだけ出る
 * @param userMessage  画面に出す文言。⚠️ 列名を入れない
 */
export function requiredText(
  value: unknown,
  field: string,
  userMessage: string,
  max: number,
): string {
  if (typeof value !== "string") throw new InvalidInputError(field, userMessage);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new InvalidInputError(field, userMessage);
  if (trimmed.length > max) {
    throw new InvalidInputError(field, `${userMessage.replace(/を入力してください$/, "")}は${max}文字以内で入力してください`);
  }
  return trimmed;
}
