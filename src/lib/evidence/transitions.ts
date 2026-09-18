/**
 * 「会社が変わった隣接ペア（＝移った）」の組み立て。**純粋関数だけ。DB に触らない。**
 *
 * ── ★なぜ1箇所に集めたか（2026-09-18）────────────────────────────────────────
 * **同じものを2つの場所が別々に数えていて、数字が食い違っていた。**
 *
 *   `/admin/evidence-gaps`（棚卸し） … `ow_experiences` からその場で算出 → 常に最新
 *   ②⑨（`lib/evidence/fetch.ts`）   … `ow_transitions` を読む → **洗い替えが手動で古い**
 *
 * 実測（2026-09-18）: セールスフォースへの経路が **棚卸し 2 / 提案 1**。
 * 同じ画面群の中で同じ数字が違う、という一番分かりにくい形だった。
 *
 * → **両方がこの関数を通る。** 数字は「揃える」のではなく
 *    **構造上ずれようがない**（同じ入力・同じ関数）。
 *
 * ⚠️★**`ow_transitions` を製品の画面から読まないこと。** あれは**導出テーブル**で、
 *    洗い替えとのあいだに必ず窓ができる。**洗い替えを自動化しても窓は消えない。**
 *    `ow_experiences` が正（CLAUDE.md）。
 *    ⚠️ ただし `ow_transitions` は**消さない**。SQL から隣接ペアを引くための表で、
 *       `age_at_move` / `years_of_experience_at_move` / `role_change` / `industry_change`
 *       を持つ（この関数は持たない）。鮮度は
 *       `/api/cron/rebuild-transitions` が保つ。
 *
 * ⚠️★**このファイルに import を足さないこと。** テストを `node --test` で
 *    素の Node から走らせる（`@/` は解決できない）。`engine.ts` と同じ約束。
 *
 * ⚠️★**同一性の規則を `rebuild_ow_transitions()` と揃えること。**
 *    片方だけ変えると、SQL 側の集計と画面の数字がまた割れる。
 */

/** 隣接を組むのに要る職歴の最小の形 */
export type TransitionExperience = {
  id: string;
  user_id: string;
  company_id: string | null;
  company_text: string | null;
  role_category_id: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
};

/** 「AからBへ移った」1件 */
export type Move = {
  userId: string;
  fromCompanyId: string | null;
  fromCompanyText: string | null;
  fromRoleCategoryId: string | null;
  toCompanyId: string | null;
  /** ★移った先に**今も在籍しているか**。在籍中と出身者を分けて数えるのに使う */
  toIsCurrent: boolean;
};

/**
 * 会社の同一性キー。
 *
 * ⚠️★**`rebuild_ow_transitions()` と同じ規則**:
 *    マスタ紐づけは `company_id`、自由入力は**正規化した社名**、
 *    どちらも無ければ**行ごとに別会社**として扱う（同じ会社か判定できないため）。
 */
export function companyKey(e: TransitionExperience): string {
  if (e.company_id) return e.company_id;
  const t = e.company_text?.trim().toLowerCase();
  if (t) return t;
  /* ⚠️ 行ごとに一意。ここを固定文字列にすると、社名の無い職歴どうしが
        「同じ会社」に見えて移動が消える。 */
  return `anon:${e.id}`;
}

/**
 * 職歴を「移った」の列に畳む。
 *
 * ⚠️ 並べ替えは `started_at` → `ended_at`（NULL は最後）。
 *    `rebuild_ow_transitions()` の `ORDER BY started_at, COALESCE(ended_at,'9999-12-31')` と同じ。
 * ⚠️ **会社が変わらない隣接は移動ではない**（同じ会社での役割変更）。
 *
 * @param rows 除外（is_test / 非公開など）を**済ませた**職歴。ここでは絞らない
 */
export function buildMoves(rows: readonly TransitionExperience[]): Move[] {
  const byUser = new Map<string, TransitionExperience[]>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }

  const out: Move[] = [];
  /* ⚠️ `for (const x of map)` にしないこと。tsconfig の target では TS2802 */
  for (const [userId, list] of Array.from(byUser.entries())) {
    const sorted = [...list].sort((a, b) =>
      a.started_at === b.started_at
        ? (a.ended_at ?? "9999-12-31").localeCompare(b.ended_at ?? "9999-12-31")
        : a.started_at.localeCompare(b.started_at),
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (companyKey(prev) === companyKey(cur)) continue;
      out.push({
        userId,
        fromCompanyId: prev.company_id,
        fromCompanyText: prev.company_text,
        fromRoleCategoryId: prev.role_category_id,
        toCompanyId: cur.company_id,
        toIsCurrent: cur.is_current,
      });
    }
  }
  return out;
}

/**
 * 企業ごとの「移ってきた人数」。★**人数なので user で重複を除く。**
 *
 * ⚠️ 1人が同じ会社に2回入っている（出戻り）と移動は2件になるが、**人数は1**。
 *    件数で数えると出戻りの人が2人に見える。
 */
export function countMovesInto(
  moves: readonly Move[],
  companyId: string,
  opts?: { onlyRoleIds?: ReadonlySet<string> },
): { current: number; alumni: number; total: number } {
  const cur = new Set<string>();
  const alu = new Set<string>();
  for (const m of moves) {
    if (m.toCompanyId !== companyId) continue;
    if (opts?.onlyRoleIds) {
      /* ⚠️ 職種で絞るときは**移る前の職種**で見る（「その職種から移ってきた」ため） */
      if (!m.fromRoleCategoryId || !opts.onlyRoleIds.has(m.fromRoleCategoryId)) continue;
    }
    (m.toIsCurrent ? cur : alu).add(m.userId);
  }
  /* ⚠️ total は「在籍中 + 出身者」ではない。**同じ人が両方に入りうる**ので数え直す */
  const all = new Set<string>([...Array.from(cur), ...Array.from(alu)]);
  return { current: cur.size, alumni: alu.size, total: all.size };
}
