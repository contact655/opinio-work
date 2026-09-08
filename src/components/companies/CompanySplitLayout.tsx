import type { CSSProperties, ReactNode } from "react";
import { CompanySplitLinks } from "./CompanySplitLinks";

/**
 * 分割ビューの骨組み（2026-09-08）。**レール＋右ペインの2列**をここだけが持つ。
 *
 * ── ⚠️★なぜ部品にしたか ────────────────────────────────────────────────────
 * 最初は `/companies` の一覧（`page.tsx`）に直書きしていたが、**絞り込みが
 * 掛かると別のコンポーネント（`CompanySearchResults`）が描画される**ため、
 * 絞り込んだ瞬間に分割ビューが消えていた（実測: 本番 HTML の `companies-split` が
 * `/companies` は4件、`?industry=ai` は **0件**）。
 * ＝ **同じ画面・同じカード部品なのに、絞り込みの有無で挙動が割れていた。**
 * 2026-09-07 に `target="_blank"` を外したときと同じ形なので、
 * **CSS ごと1箇所に集約して、2つの呼び出し元が同じものを使う**ようにした。
 *
 * ⚠️ **CSS を呼び出し側にコピーしないこと。** 割れたら、片方の画面でだけ
 *    ペインが出ない（または出るのにレールが3列のまま）という形になる。
 *
 * ⚠️★**ペインは `CompanySplitLinks` の外に置く。** 中に入れると、ペインの
 *    「詳細を見る →」まで横取りされて**全画面へ行けなくなる**（自分自身を
 *    選び直すだけになる）。
 */
export function CompanySplitLayout({
  /** レール側（カードのグリッド）。⚠️ グリッドの class は下の CSS に列挙が要る */
  children,
  /** 右ペイン。null なら分割せず、レールが元の多列グリッドのまま出る */
  pane,
  /**
   * ★読み上げ用の企業名（2026-09-08）。ペインが入れ替わったことを伝えるためだけに使う。
   *
   * ⚠️★**ペインの中身そのものを読み上げさせない。** `aria-live` を右ペインに付けると、
   *    選ぶたびに要約が丸ごと読み上げられて使い物にならない。**1文だけ**にする。
   * ⚠️ **フォーカスは動かさない。** ペインへ移すとレールの続きを見るのに戻る操作が要り、
   *    「一覧を眺めながら見比べる」という分割ビューの目的と衝突する。
   *    どのカードが開いているかは `aria-current`（`CompanyCardList`）が伝える。
   */
  paneLabel = null,
  /**
   * ★左レールの幅（2026-09-09）。**表示形式で必要な幅が違う。**
   *
   * | 表示 | 幅 | 理由 |
   * |---|---|---|
   * | 一覧（compact カード） | **420** | フェーズ0の実測で 380px でも 40件中39件がクランプ無しに収まる |
   * | 詳細（list 行） | **700** | 1行の固定部分が **499px**（padding 40 + gap 18×3 + ロゴ68 + 実数241 + ボタン96）。420 だと本文が 0 になる |
   *
   * ⚠️★**メディアクエリの中で使う変数として渡している。** 値そのものはインラインだが、
   *    「分割するかどうか」は下の `@media (min-width: 1280px)` が握ったまま。
   *    ⚠️ ここに `@media` を増やして幅を出し分けないこと。呼び出し側が知っている値なので、
   *       CSS 側で表示形式を判定し直すと二重管理になる。
   */
  railWidth = 420,
}: {
  children: ReactNode;
  pane: ReactNode;
  paneLabel?: string | null;
  railWidth?: number;
}) {
  return (
    <>
      <style>{`
        /* ── 分割ビュー（2026-09-08）────────────────────────────────────
           ⚠️★1280px 未満ではペイン列ごと出さない。狭い画面で右に畳むと、
              レールもペインも読めなくなる。?selected= を直リンクで開いても同じ。
           ⚠️ クリックを振り替えるのは CompanySplitLinks。あちらは
              lib/constants/splitView.ts の SPLIT_MIN_WIDTH を見ている。
              CSS からは定数を参照できないので、**この 1280 は手で合わせている。**
              片方だけ変えると「クリックは振り替わるのにペインが出ない」になる。
           ⚠️★ここは style タグのテンプレートリテラルの中。2つ踏んだ:
              (1) バッククォートを書くと文字列が途中で閉じる
              (2) 山かっこ付きのタグ名を書くと、サーバーだけ実体参照にエスケープ
                  されてハイドレーション不一致になる
              どちらもコメントの文字だけで起きる。記号を書かないこと。 */
        .companies-split { display: block; }
        .companies-pane { display: none; }
        @media (min-width: 1280px) {
          .companies-split {
            display: grid;
            /* 左レールの幅は --rail-w（呼び出し側が渡す。既定 420px）。
               ⚠️ 一覧は 420、詳細（list 行）は 700。理由は railWidth の注記。
               ⚠️ ここは style タグのテンプレートリテラルの中。**引用の記号を書かないこと**
                  （2026-09-09 にこの行で実際に文字列が途中で閉じた）。 */
            grid-template-columns: var(--rail-w, 420px) minmax(0, 1fr);
            gap: 20px;
            align-items: start;
          }
          /* ⚠️★レールでは必ず1列。多列のままだと1枚 130px になる。
                 ⚠️ **グリッドの class を列挙している。** 一覧は companies-grid4、
                    絞り込み結果は search-results-grid と別名なので、
                    3つ目のグリッドを分割ビューに載せるときはここに足すこと。
                    足し忘れると、そのページだけレールが多列のまま潰れる。 */
          .companies-split .companies-grid4,
          .companies-split .search-results-grid {
            grid-template-columns: minmax(0, 1fr);
            gap: 10px;
          }
          .companies-pane {
            display: block;
            /* ⚠️ sticky はここ（ページ側の列）に置く。CompanyPane の中には置かない
                  （あの部品は fixed/sticky を持たない約束）。
               ⚠️ top はヘッダー(60) + 検索バー帯のぶん。実測で調整した。 */
            position: sticky;
            top: 150px;
            max-height: calc(100vh - 170px);
            overflow-y: auto;
          }
        }
      `}</style>
      {/* ★ペインが入れ替わったことを伝えるライブリージョン（2026-09-08）。
             カードのクリックは `preventDefault` するのでフォーカスはカードに残り、
             右ペインの中身が**無言で入れ替わる**。それを1文だけ伝える。

          ⚠️★**この要素は常に描く。空でも消さない。** ライブリージョンは
             **中身が変わる前から DOM に居ないと読み上げられない。**
             `pane` があるときだけ描くと、**最初の1回が必ず読み上げられない。**
          ⚠️★**位置を動かさないこと。** RSC の更新で React が同じ位置の要素を
             使い回すからテキストだけが差し替わる。条件付きの兄弟より前に置いてあるのは
             そのため（後ろに置くと `aside` の有無で index がずれて作り直されうる）。 */}
      <div aria-live="polite" className="sr-only">
        {paneLabel ? `${paneLabel} の概要を表示しました` : ""}
      </div>
      <div
        className={pane ? "companies-split" : undefined}
        /* ⚠️ カスタムプロパティなので、分割しないとき（`companies-split` が付かないとき）は
              誰も読まない。無害なので出し分けていない。 */
        style={{ "--rail-w": `${railWidth}px` } as CSSProperties}
      >
        {/* ⚠️ クリック横取りは 1280px 以上でだけ働く。狭い画面ではカードは
               素の a として全画面へ遷移する。 */}
        <CompanySplitLinks>{children}</CompanySplitLinks>
        {pane && (
          <aside className="companies-pane" aria-label="選択した企業の概要">
            {pane}
          </aside>
        )}
      </div>
    </>
  );
}
