import { findQueryRange } from "@/lib/companies/normalizeName";

/**
 * 候補の社名のうち、**打った文字に当たった部分**を太字にする。
 *
 * ── なぜ要るか（2026-10-01 / 柴さんの指示）───────────────────────────────────
 * 実ユーザーが「セールスフォース」と打ったのに候補を選ばず、自由入力で登録した。
 * 候補は出ていた（1件だけ）が、**主ラベルは表示名の「Salesforce」**なので
 * 打った文字と字面が違い、自分の勤務先だと気づけなかった。
 * ⚠️ 正式名を副題に添える対処（2026-09-28）だけでは足りなかった、ということ。
 *
 * ⚠️★**正規化どうしで突き合わせている**（`findQueryRange`）。だから
 *    「せーるすふぉーす」「ｾｰﾙｽﾌｫｰｽ」「セールスフォースジャパン」と打っても、
 *    カタカナの社名のどこに当たったかを示せる。**単なる indexOf に戻さないこと。**
 *
 * ⚠️★**レイアウトを持たない。** `<span>` を返すだけで、大きさ・色・省略は
 *    親から継ぎ、当たった部分だけ `fontWeight` と `color` を上書きする。
 *    候補行の見た目は3箇所で**意図的に違う**ので、ここで揃えにいかないこと
 *    （理由は `useCompanyLookup.ts` の冒頭）。
 *
 * ⚠️ 当たらなければ素のテキストを返すだけ。**候補を出す／出さないの判断には使わない**
 *    （一致判定は DB の `search_key` が持つ）。
 */
export function HighlightedName({ text, query }: { text: string; query: string }) {
  const range = findQueryRange(text, query);
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      {/* ⚠️ `<mark>` にしない。既定の黄色い背景が付き、候補行の見た目が3箇所で割れる */}
      <span style={{ fontWeight: 700, color: "var(--royal)" }}>{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  );
}
