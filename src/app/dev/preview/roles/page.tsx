import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { RolePickerDemo } from "./Demo";

/**
 * オンボーディングの職種選択（大分類 → 小分類）。2026-09-04 追加。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * **`/onboarding` はログインの内側**にあり、しかも会社を選ぶまで職種欄が出ない。
 * 「親を2つ以上選んだとき」の見え方を確かめるのに、毎回ログインして
 * 会社を選んで…と踏むことになる。**ここなら1画面で全状態を並べられる。**
 *
 * ── 何を見るか ──────────────────────────────────────────────────────────────
 * ⚠️★**親を2つ選んだ状態**（柴さんの指摘の状態）で、
 *    「どこまでが営業の子で、どこからがエンジニアの子か」が読めること。
 *    直す前は見出しが全体で1つしか無く、28件が地続きに見えていた。
 * ⚠️ 親チップの**下向きシェブロン**は「下に箱を開いている」印。
 *    ⚠️ 子を持たない親（このデータでは営業・エンジニア以外）には**出ない**こと。
 * ⚠️ 上限5件に達したら、**未選択の親チップを押しても増えない**こと
 *    （API 側も5件で切るので、ここで通すと「選べたのに保存されない」になる）。
 */
export default function RolesPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="職種の選択（大分類 → 小分類）">
        <p style={{ margin: 0 }}>
          `/onboarding` の職種欄です。ログインの内側かつ会社を選ぶまで出ないので、
          ここで全状態を並べています。
        </p>
      </PreviewHeader>

      <Variant label="未選択" note="親18件だけ。小分類の箱は出ない">
        <RolePickerDemo initial={[]} />
      </Variant>

      <Variant label="親を1つ選択（営業）" note="その親の子12件だけが、名前付きの箱で開く">
        <RolePickerDemo initial={["p-営業"]} />
      </Variant>

      <Variant
        label="★親を2つ選択（営業＋エンジニア）"
        note="指摘のあった状態。26件が地続きに見えないか、境目が読めるかを見る"
      >
        <RolePickerDemo initial={["p-営業", "p-エンジニア"]} />
      </Variant>

      <Variant
        label="子を選んだ状態"
        note="親は選択から外れ、子に置き換わる。親チップは選択中の見た目のまま残る"
      >
        <RolePickerDemo initial={["c-フィールドセールス", "c-バックエンド"]} />
      </Variant>

      <Variant
        label="上限5件"
        note="ここから未選択の親チップを押しても増えないこと。子への差し替えはできること"
      >
        <RolePickerDemo initial={["p-経営・CxO", "p-事業開発", "p-営業", "p-マーケティング", "p-エンジニア"]} />
      </Variant>
    </div>
  );
}
