/**
 * 業種（`ow_industries`）の選択肢を取る。
 *
 * ⚠️ **選択肢をコードに書かないこと。** 業種は 2026-08-25 に
 *    `ow_industries` のフラット20件へ作り直した。**マスタが唯一の出どころ。**
 *    以前は `lib/search/industryGroups.ts` の `INDUSTRY_SELECT_GROUPS`（text）を
 *    企業側のフォームが使っており、企業が選んだ値と運営が見る値が別列だった。
 *
 * ⚠️ **保存するのは `id`。** 表示名（`name`）を保存に使わないこと。
 *    綴りが1文字ずれると、その企業が業種で絞れなくなる（`ow_companies.industry`
 *    の text がまさにそれで、`IT / SaaS` などマスタに無い値が4種残っている）。
 *
 * ⚠️ **`is_active = true` で絞る。** ただし**編集画面で現在値を出す用途では絞らないこと**
 *    （無効化された業種に紐づく企業を開いたとき、セレクトに現在値が出ず、
 *    保存すると業種が消えたように見える）。運営画面は自前で全件を引いている。
 */

export type IndustryOption = {
  id: string;
  name: string;
  slug: string;
  /**
   * ★選択肢に添える短い説明（2026-09-05 に列を追加）。**迷いやすい組にだけ付く。**
   * 2026-09-05 時点は5件 —— 製造の3値（電機・機械 / 素材・化学 / 食品・飲料）と
   * 商社・卸売 / 小売・流通。それ以外は **null**。
   *
   * ⚠️ **UI 側の定数にしないこと。** 業種マスタはこの2週間で2回動いており
   *    （不動産・建設の分割 / インターネット・Web の統合）、別ファイルに置くと
   *    値を足したときに追従を忘れる。マスタと同じ行に持つ。
   * ⚠️ **null のときは行を出さない。** 「—」も出さない（説明が要らない業種なので）。
   */
  description: string | null;
  /**
   * ★2階層の親（2026-09-05）。**「製造業」だけが親を持つ。**
   * 子は 電子機器・半導体 / 電機・機械 / 素材・化学 / 食品・飲料 の4つ。
   *
   * ⚠️ **親も選べる。** `<optgroup>` のラベルは選択できないので、
   *    各グループの先頭に**親自身の option** を置くこと
   *    （置かないと「製造業としか言えない人」が詰まる）。
   * ⚠️ `display_order` は**親ごとの相対順**（`ow_roles` と同じ）。
   *    フラットに `order("display_order")` して並べない —— 木に組んでから並べる。
   */
  parent_id: string | null;
};

/** ⚠️ `.select()` には文字列リテラルを渡す（配列を join すると型が落ちる）。 */
export const INDUSTRY_OPTION_COLS = "id, name, slug, description, parent_id" as const;

/**
 * 新規登録フォーム用の選択肢。有効な業種を `display_order` 順で返す。
 *
 * サーバー・ブラウザどちらの Supabase クライアントでも使える（どちらも
 * `ow_industries` を SELECT できる。anon にも `is_active = true` の
 * 読み取りポリシーがある）。
 *
 * ⚠️ **error を握りつぶさない。** 空配列で返すとフォームは
 *    「選択肢が無い」状態になり、権限やネットワークの失敗と区別が付かない。
 */
export async function fetchIndustryOptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  label: string,
): Promise<IndustryOption[]> {
  const { data, error } = await db
    .from("ow_industries")
    .select(INDUSTRY_OPTION_COLS)
    .eq("is_active", true)
    /* ⚠️ `display_order` は**親ごとの相対順**なので、これだけでは親子が混ざる。
          並べ替えは呼び出し側（`buildIndustryTree` → `flattenIndustryOptions`）で行う。
          ここで order を外さないのは、同じ親の中の順序をDBに決めさせるため。 */
    .order("display_order", { ascending: true });

  if (error) {
    console.error(`[${label}] ow_industries の取得に失敗:`, error.message);
    return [];
  }
  return (data ?? []) as IndustryOption[];
}

/**
 * ★`<select>` に出す順に並べ替える（親 → その子 → 次の親 …）。
 *
 * ⚠️ `display_order` は**親ごとの相対順**なので、DB から来た配列をそのまま
 *    並べると親子が混ざる。**必ずこれを通すこと。**
 *
 * ⚠️ 返すのは「親自身も含む」平坦な配列。**親も選べる**ので、
 *    `<optgroup>` を使うときは各グループの先頭に親を置くこと。
 */
export function flattenIndustryOptions(options: IndustryOption[]): IndustryOption[] {
  const children = new Map<string, IndustryOption[]>();
  const roots: IndustryOption[] = [];
  const ids = new Set(options.map((o) => o.id));
  for (const o of options) {
    if (o.parent_id && ids.has(o.parent_id)) {
      const arr = children.get(o.parent_id) ?? [];
      arr.push(o);
      children.set(o.parent_id, arr);
    } else {
      roots.push(o);
    }
  }
  const out: IndustryOption[] = [];
  for (const r of roots) {
    out.push(r);
    for (const c of children.get(r.id) ?? []) out.push(c);
  }
  return out;
}

/** 親 id → 子の配列。⚠️ 子を持たない親はキーごと無い */
export function groupIndustryChildren(options: IndustryOption[]): Map<string, IndustryOption[]> {
  const ids = new Set(options.map((o) => o.id));
  const map = new Map<string, IndustryOption[]>();
  for (const o of options) {
    if (o.parent_id && ids.has(o.parent_id)) {
      const arr = map.get(o.parent_id) ?? [];
      arr.push(o);
      map.set(o.parent_id, arr);
    }
  }
  return map;
}
