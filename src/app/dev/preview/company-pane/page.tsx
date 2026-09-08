import { CompanyPane } from "@/components/companies/CompanyPane";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { PANE_RICH, PANE_THIN, PANE_EMPTY } from "../fixtures";

/**
 * 企業ペイン（`CompanyPane`）のプレビュー（2026-09-08）。
 *
 * ⚠️★★**この画面だけ「固定幅の箱に入れて」見る。** 他のプレビューは
 *    `Variant.tsx` の注記どおり**固定幅で並べてはいけない**（メディアクエリは
 *    ビューポート幅を見るので、固定幅の箱では発火しない）。
 *    **`CompanyPane` は逆で、メディアクエリを1つも持たない。**
 *    幅はコンテナで決まる設計なので、**箱の幅を変えて見るのが唯一の正しい確認方法**。
 *    ⚠️ ここを「全幅に直す」と、この部品で一番見たいこと（狭いペインで崩れないか）が
 *       まったく見えなくなる。**戻さないこと。**
 *
 * ⚠️ 幅の候補はフェーズ0の実測に基づく。1440px の画面で左レールを 380〜480px 取ると、
 *    右ペインは **700〜900px** になる。380 は「レールに入れた場合」の下限確認用。
 *
 * ⚠️ 実データが薄いので（CLAUDE.md「企業詳細の中身はほぼ Salesforce 1社しか
 *    埋まっていない」）、**厚い側・薄い側・空**の3つを必ず見ること。
 *    厚い側だけ見て「崩れない」と言わない。
 */
const WIDTHS = [380, 480, 700, 900];

function Row({ label, data }: { label: string; data: typeof PANE_RICH }) {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
      {WIDTHS.map((w) => (
        <div key={w} style={{ flex: "0 0 auto" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "var(--ink-mute)", marginBottom: 6,
            fontFamily: "var(--font-inter), var(--font-noto)",
          }}>
            {label} / {w}px
          </div>
          {/* ⚠️ ここが「ペイン」に相当する箱。`overflow` を付けないこと ——
                 付けるとはみ出しが隠れて、崩れているのに崩れて見えなくなる。 */}
          <div style={{ width: w, background: "var(--bg-tint)", padding: 16, borderRadius: 12 }}>
            <CompanyPane
              company={data.company}
              detail={data.detail}
              targetIndustries={data.targetIndustries}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CompanyPanePreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader
        title="企業ペイン（分割ビューの右側）"
        /* ⚠️★既定の帯（「固定幅の箱に入れていない」）はこの画面では**逆**なので差し替える。 */
        widthNote={
          <>
            ⚠️ <strong>この画面だけ固定幅の箱に入れて見ます</strong>（380 / 480 / 700 / 900px）。
            <code>CompanyPane</code> は<strong>メディアクエリを1つも持たず</strong>、幅はコンテナで決まる設計なので、
            ブラウザをリサイズしても中身は変わりません。<strong>箱の幅を変えて見るのが唯一の確認方法</strong>です。
          </>
        }
      >
        <code>CompanyPane</code> です。<strong>企業詳細（2,134行）は使い回さず、要約だけを出す別部品</strong>。
        詳細ページを 700px のコンテナに入れるとサイドバーが 320px のまま残って本文が 256px に潰れ、
        製品グリッドが5列を維持して各115pxになる（実測・はみ出し49件）ため。
      </PreviewHeader>

      <Variant
        label="★厚い側（Salesforce 相当）"
        note="⚠️ 長い社名・長いタグライン・求人5件。380px で社名が親を押し広げていないか、バッジ行が折り返せているか"
      >
        <Row label="厚い" data={PANE_RICH} />
      </Variant>

      <Variant
        label="★薄い側（フォトラクション相当）"
        note="⚠️ 求人0件・顧客の業界なし・設立/代表者/本社が空。求人ブロックと「話を聞く」が**要素ごと消えている**こと（「0件」「—」で埋めない）"
      >
        <Row label="薄い" data={PANE_THIN} />
      </Variant>

      <Variant
        label="★すべて空"
        note="⚠️ タグライン・事業領域・従業員数・求人・URL がすべて空。求人ブロックと「話を聞く」が要素ごと消えていること"
      >
        <Row label="空" data={PANE_EMPTY} />
      </Variant>

      <div style={{
        marginTop: -18, marginBottom: 28, padding: "10px 12px", borderRadius: 8,
        background: "#FFFBEB", border: "1px solid #FDE68A",
        fontSize: 12, color: "var(--warm-ink)", lineHeight: 1.8,
      }}>
        ⚠️★<strong>「すべて空」では「企業情報」が見出しだけの空箱になります。既知・未修正です。</strong>
        <br />
        <code>CompanyInfoBox</code> は行ごとに <code>.filter((item) =&gt; item.value)</code> で落としますが、
        <strong>全行落ちても箱と見出しは残ります</strong>。
        <br />
        ⚠️ <strong>本番では起きません。</strong>事業領域は<strong>掲載83社すべてが持っている</strong>
        （2026-09-07 実測。100% 埋まっている唯一の分類）ので、行が0になる企業が存在しません。
        <br />
        ⚠️ 直すなら <code>CompanyInfoBox</code> の items 配列を JSX の外に出して
        <code>rows.length === 0 &amp;&amp; genres.length === 0</code> なら <code>null</code> を返す形。
        ただし<strong>企業詳細ページと共有している部品</strong>なので、
        サイドバーの出力が1バイトも変わらないことを確かめてから入れること
        （前例: <code>c97f7c49</code> は <code>&lt;aside&gt;</code> の SHA-256 を突き合わせている）。
      </div>

      <div style={{
        marginTop: 8, padding: "12px 14px", borderRadius: 8,
        background: "#FFFBEB", border: "1px solid #FDE68A",
        fontSize: 12, color: "var(--warm-ink)", lineHeight: 1.8,
      }}>
        ⚠️ <strong>ここに出していない項目は詳細ページにしかない</strong>
        （製品・導入事例・社員・OB/OG・記事・更新情報・福利厚生・組織体制・ツール・拠点/資本）。
        <br />
        ペインは要約であって詳細の置き換えではないので、<strong>「詳細を見る →」を必ず残すこと。</strong>
      </div>
    </div>
  );
}
