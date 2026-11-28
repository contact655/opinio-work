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
  /** カテゴリ（2026-11-28）。無い項目は「その他」として扱う（既存データを壊さないため） */
  category?: BenefitCategory;
};

/**
 * ★福利厚生のカテゴリ（2026-11-28 / 柴さんの指示。この7つで固定。表示もこの順番）。
 *   値は英語のキーで jsonb の各項目に持つ（`{"name": "...", "category": "learning"}`）。表示名はここだけ。
 * ⚠️ この7つ以外の値は保存させない（PUT /api/biz/company が 400 を返す。`hasInvalidBenefitCategory`）。
 * ⚠️ 並び順を変えない。企業ページの表の行の順番そのもの。
 * ⚠️ このファイルは何も import しない（`npm test` が直接読む）。
 */
export const BENEFIT_CATEGORIES = [
  { key: "money", label: "お金・報酬" },
  { key: "time_off", label: "休み" },
  { key: "workstyle", label: "働き方・環境" },
  { key: "learning", label: "学び・成長" },
  { key: "health", label: "健康・保険" },
  { key: "family", label: "家族・育児" },
  { key: "other", label: "その他" },
] as const;

export type BenefitCategory = (typeof BENEFIT_CATEGORIES)[number]["key"];

const CATEGORY_KEYS: ReadonlySet<string> = new Set(BENEFIT_CATEGORIES.map((c) => c.key));

export function isBenefitCategory(v: unknown): v is BenefitCategory {
  return typeof v === "string" && CATEGORY_KEYS.has(v);
}

/** カテゴリが無い項目は「その他」 */
export function benefitCategoryOf(b: Pick<Benefit, "category">): BenefitCategory {
  return b.category ?? "other";
}

/**
 * 保存の前の確認。7つ以外の `category` を持つ項目が1つでもあれば true。
 * ⚠️ `category` が無い項目は不正にしない（既存データと、カテゴリ導入前に作った項目のため。「その他」として扱う）。
 */
export function hasInvalidBenefitCategory(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  return raw.some((item) => {
    if (!item || typeof item !== "object") return false;
    const c = (item as Record<string, unknown>).category;
    return c !== undefined && c !== null && !isBenefitCategory(c);
  });
}

/** カテゴリの順に並べて、項目のあるカテゴリだけを返す（企業ページの表と入力画面の一覧が使う） */
export function groupBenefitsByCategory<T extends Pick<Benefit, "category">>(items: T[]): { key: BenefitCategory; label: string; items: T[] }[] {
  return BENEFIT_CATEGORIES
    .map((c) => ({ key: c.key as BenefitCategory, label: c.label as string, items: items.filter((b) => benefitCategoryOf(b) === c.key) }))
    .filter((g) => g.items.length > 0);
}

/**
 * 「働き方・環境」の項目が、企業ページの「働き方」のどの枠（勤務時間／リモート）の話かを返す（2026-11-28）。
 * ⚠️ これを使うのは category が workstyle の項目だけ（名前の語だけで外すのはやめた。「在宅勤務手当」が外れていた）。
 * ⚠️ どの枠にも当たらない項目（例: 副業可）は null。福利厚生の側に残す。
 */
export function workstyleBoxKeyOf(name: string): "time" | "remote" | null {
  if (/フレックス|裁量労働|コアタイム|勤務時間|時短/.test(name)) return "time";
  if (/リモート|在宅|テレワーク|出社/.test(name)) return "remote";
  return null;
}

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
      const b: Benefit = detail ? { name, detail } : { name };
      /* ★カテゴリ（2026-11-28）。7つ以外の値は持たせない（「その他」として扱われる） */
      if (isBenefitCategory(rec.category)) b.category = rec.category;
      out.push(b);
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
    .map((b) => ({ name: (b.name ?? "").trim(), detail: (b.detail ?? "").trim(), category: b.category }))
    .filter((b) => b.name !== "")
    .map((b) => {
      const o: Benefit = b.detail ? { name: b.name, detail: b.detail } : { name: b.name };
      /* ★カテゴリを落とさない（2026-11-28）。7つ以外は保存しない */
      if (isBenefitCategory(b.category)) o.category = b.category;
      return o;
    });
  return out.length > 0 ? out : null;
}
