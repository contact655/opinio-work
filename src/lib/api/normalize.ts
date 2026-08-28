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
 * ⚠️ **text 列だけの話ではない。** JSONB の `ow_users.social_links` も同じ形で
 *    `{"note": ""}` が残っていた（2026-08-16 に `optionalTextMap` を足して解消）。
 *    値が text のマップを受け取る列を足すときは、この関数を通すこと。
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
 * 任意の「キー → text」マップ（JSONB 列）。**空の値はキーごと落とし、
 * 全部空なら `null` にする。**
 *
 * ⚠️ **キーを空文字のまま残さない。** 残すと2つ困る:
 *    ① SQL の充填率集計が「入力済み」と数える（`optionalText` と同じ理由）
 *    ② **画面から元の状態に戻せなくなる。** 全部消して保存しても `{"x": ""}` が残り、
 *       `null` に戻す手段が UI に無い（2026-08-16 までの `ow_users.social_links` が
 *       これで、検証のたびに service role で書き戻していた）
 *
 * ⚠️ 空（`null` / `""` / 空白のみ）は正常系なので落とす。
 *    **型が違うもの（数値・配列・入れ子）は異常系なので 400。** 黙って捨てない。
 *
 * @param field ログ用の列名。⚠️ 利用者に見せる文言には出さない
 */
export function optionalTextMap(
  value: unknown,
  max: number,
  field: string,
  userMessage: string,
): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidInputError(field, userMessage);
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null || v === undefined) continue; // 空扱い（キーを落とす）
    if (typeof v !== "string") throw new InvalidInputError(`${field}.${k}`, userMessage);
    const trimmed = v.trim();
    if (trimmed.length === 0) continue;
    out[k] = trimmed.slice(0, max);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * `optionalTextMap` と同じだが、**値が URL であることまで確かめる**。
 * `ow_users.social_links` のような「値が全部 URL のマップ」に使う。
 *
 * ── ★なぜ DB の CHECK を張らないか（2026-08-28 に決めた）──────────────────
 * CLAUDE.md の「UI / API / DB の CHECK を3つ揃える」は
 * **値の集合（選択肢・状態・区分）の制約**が対象で、これは**形式の制約**。
 * そして JSONB の全キーを見る CHECK は**素では書けない**
 * （`jsonb_each_text` を使うと副問い合わせになり、CHECK 制約は副問い合わせを許さない）。
 * 関数に逃がすことはできるが、**テーブル定義を読んでも分からない隠れた挙動**が増える
 * （`ow_company_members` の `guard_member_consent` で実際にそれを踏んでいる）。
 *
 * → **UI と API の2層で守ると決めた。**
 *   UI: 入力欄が `type="url"` で、placeholder が全て `https://…`（`SOCIAL_META`）。
 *   API: この関数。
 * ⚠️ **「縛らないと決めた」ことをここに書き残してある。消さないこと。**
 *
 * ── ★入れる前に実データを 0 件にした ───────────────────────────────────────
 * `social_links` は `PUT /api/jobseeker/profile` に**他の項目と一緒に載る**ので、
 * 壊れた値が1つでも残っていると、そのユーザーは**名前の変更すら保存できなくなる**。
 * 2026-08-28 に唯一の壊れた行（`github: "a"`）を
 * `20260828100000_fix_broken_social_link.sql` で落としてから有効にした。
 * ⚠️ **順序を逆にしないこと。**
 *
 * @param field ログ用の列名。⚠️ 利用者に見せる文言には出さない
 */
export function optionalUrlMap(
  value: unknown,
  max: number,
  field: string,
  userMessage: string,
): Record<string, string> | null {
  const map = optionalTextMap(value, max, field, userMessage);
  if (map === null) return null;
  for (const [k, v] of Object.entries(map)) {
    let parsed: URL;
    try {
      parsed = new URL(v);
    } catch {
      throw new InvalidInputError(`${field}.${k}`, userMessage);
    }
    /* ⚠️ プロトコルまで見る。`new URL()` は `javascript:alert(1)` も `mailto:` も
          通すので、**成功しただけでは足りない**。
       ★https のみ。`content-links` と揃えてある —— todo の指摘そのものが
         「同じ外部リンクなのに扱いが揃っていない」だった。
       ⚠️ **http を通す形に緩めないこと。** 緩めると、画面に出す文言
          （「https:// で始まる URL を…」）と実装がずれる。SNS 7サービスは
          いずれも https のみで配信しているので、通して得るものが無い。 */
    if (parsed.protocol !== "https:") {
      throw new InvalidInputError(`${field}.${k}`, userMessage);
    }
  }
  return map;
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
