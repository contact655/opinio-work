import { Fragment } from "react";

/**
 * 業種の `<select>` に出す `<option>` 群。**4画面で同じものを使う。**
 *
 * ── ⚠️★親も選べる形にすること（2026-09-05）────────────────────────────────
 * `<optgroup label>` は**選択できない**。ラベルだけにすると
 * 「製造業としか言えない人」が詰まるので、**各グループの先頭に親自身の option** を置く。
 *
 *   製造業                 ← ★これも選べる（親の option）
 *     電子機器・半導体
 *     電機・機械
 *     …
 *
 * ⚠️ 子を選ぶほうが利用者にとって**得**（突合は本人側を祖先展開するので、
 *    子を選ぶと親向けの企業にも当たる）。ただし**注意書きは足さない**——
 *    親のままでも壊れないので、選び方を説明する行を増やさない。
 *
 * ⚠️ `display_order` は**親ごとの相対順**なので、
 *    渡す前に `flattenIndustryOptions` か、この関数のように親子で組み立てること。
 *    フラットに並べると親子が混ざる。
 *
 * ⚠️ 子を持たない業種（17件）は `<optgroup>` で包まない。包むと
 *    **1件だけのグループ**が17個並んで読みにくくなる。
 */

export type IndustryOptionLike = {
  id: string;
  name: string;
  parent_id: string | null;
  /** 無効な業種にも印を付けたい画面（/admin）がある。省略時は付けない */
  is_active?: boolean;
};

export function IndustrySelectOptions({ options }: { options: IndustryOptionLike[] }) {
  const ids = new Set(options.map((o) => o.id));
  const children = new Map<string, IndustryOptionLike[]>();
  const roots: IndustryOptionLike[] = [];
  for (const o of options) {
    if (o.parent_id && ids.has(o.parent_id)) {
      const arr = children.get(o.parent_id) ?? [];
      arr.push(o);
      children.set(o.parent_id, arr);
    } else {
      roots.push(o);
    }
  }

  const label = (o: IndustryOptionLike) =>
    `${o.name}${o.is_active === false ? "（無効）" : ""}`;

  return (
    <>
      {roots.map((r) => {
        const kids = children.get(r.id) ?? [];
        if (kids.length === 0) {
          return <option key={r.id} value={r.id}>{label(r)}</option>;
        }
        return (
          <Fragment key={r.id}>
            <optgroup label={r.name}>
              {/* ★親自身。⚠️ 消さないこと（optgroup のラベルは選択できない） */}
              <option value={r.id}>{label(r)}</option>
              {kids.map((c) => (
                /* ⚠️ 全角スペースで字下げする。CSS の padding は
                      <option> にブラウザ差があって効かないことがある。
                   ⚠️★テンプレートリテラルで**1つのテキストノード**にする。
                      `　{label(c)}` と書くと React が区切りに `<!-- -->` を挟み、
                      HTML を grep する検証で社名が引っかからなくなる
                      （`.claude/rules/ui-debugging.md` ⑨ の罠。実際に踏んだ）。 */
                <option key={c.id} value={c.id}>{`　${label(c)}`}</option>
              ))}
            </optgroup>
          </Fragment>
        );
      })}
    </>
  );
}
