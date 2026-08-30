/**
 * 福利厚生の1項目（2026-08-31）。
 *
 * ⚠️★**型はここだけに置く。** 各ファイルで `{name: string; detail?: string}` を
 *    書き直さないこと。今日（2026-08-31）直した「同じものが2箇所にあって食い違う」
 *    事故を、自分で作ることになる。
 *
 * ── DB の形 ────────────────────────────────────────────────────────────────
 *   `ow_companies.benefits` は **jsonb**（2026-08-31 に `text[]` から移行）。
 *   `[{"name": "書籍・学習費用補助", "detail": "年間65万円（学習機関の指定あり）"}]`
 *
 * ⚠️ `detail` は**任意**。無いときは **キーごと省く**（`null` を入れない）。
 *    「未入力」と「空文字を入れた」を後から区別できるようにするため。
 *    → CLAUDE.md「値が無いことを、ある値に置き換えない」
 */
export type Benefit = {
  /** 表示名。必須。空文字は不正 */
  name: string;
  /** 補足。任意。**空文字を入れないこと**（未入力はキーごと省く） */
  detail?: string;
};

/**
 * DB から来た jsonb を `Benefit[]` に正規化する。
 *
 * ⚠️★**移行期の古い形（`string[]`）も受ける。** migration を当てる前後で
 *    アプリが両方の形に出会う瞬間があるため（デプロイと migration は同時でも、
 *    ISR のキャッシュに古い形が残りうる）。
 *    ⚠️ 移行が終わっても**この分岐を消さないこと。** 消しても得るものが無く、
 *       消した日に古いキャッシュを踏むと画面が落ちる。
 *
 * ⚠️ `name` の無い要素・空文字の要素は**落とす**。描画側で `name` の存在を
 *    確認せずに済むようにする（`undefined` がそのまま画面に出るのを防ぐ）。
 *
 * ⚠️ 0件のときは **null** を返す（`[]` ではない）。呼び出し側は
 *    「セクションごと出さない」判定に使っており、既存の挙動を変えないため。
 */
export function normalizeBenefits(raw: unknown): Benefit[] | null {
  if (!Array.isArray(raw)) return null;

  const out: Benefit[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      /* 旧形式（text[]）。詳細は持てない */
      const name = item.trim();
      if (name) out.push({ name });
      continue;
    }
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      if (!name) continue;
      const detail = typeof rec.detail === "string" ? rec.detail.trim() : "";
      /* ⚠️ 空文字なら `detail` を**付けない**。`detail: ""` にすると
            「詳細がある」と判定され、空のポップアップが出る。 */
      out.push(detail ? { name, detail } : { name });
    }
  }
  return out.length > 0 ? out : null;
}

/**
 * 保存する形に整える（`/biz` の入力欄 → DB）。
 *
 * ⚠️ 空の `name` は落とす。`detail` は空なら**キーごと省く**。
 * ⚠️ 0件なら `null` を返す（列を空配列で埋めない）。
 */
export function serializeBenefits(items: Benefit[]): Benefit[] | null {
  const out = items
    .map((b) => ({ name: (b.name ?? "").trim(), detail: (b.detail ?? "").trim() }))
    .filter((b) => b.name !== "")
    .map((b) => (b.detail ? { name: b.name, detail: b.detail } : { name: b.name }));
  return out.length > 0 ? out : null;
}
