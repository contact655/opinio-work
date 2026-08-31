import { CompanyCardList } from "@/components/companies/CompanyCardList";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { COMPANY_CARDS_MISSING, COMPANY_CARDS_LONG, COMPANY_CARDS_12, COMPANY_CARDS_REAL_MIX } from "../fixtures";

/**
 * 企業カード（一覧）のプレビュー（2026-08-31）。
 *
 * ⚠️ 実データは79社あるが、**欠けのパターンが偏っている。**
 *    tagline は 78/79 社にあり空は1社だけ、`logo_url` の NULL も2社だけ。
 *    「全部欠けている企業」は実データに1社も無い。
 *
 * ⚠️★**実ページと同じグリッドを使うこと。** `/companies` は
 *    グリッド表示（`compact`）とリスト表示の2形態があり、
 *    グリッドは 3列 / 1199px以下 2列 / 600px以下 1列。
 *    ここで独自のグリッドを組むと、**列の折り返し方が実ページと変わる。**
 *
 * ⚠️ CLAUDE.md の既知の論点:
 *    **375px は1列**なので行内に他のカードが無く、
 *    **tagline が空のカードだけ 19px 低い**（124px vs 143px）。
 *    1440px / 1199px / 768px では CSS Grid の行内 stretch で全カードが揃う。
 */
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* ⚠️ `/companies` の `.companies-grid4` と同じ定義。ずらさないこと。
             ⚠️ このスタイルタグの中に山括弧と二重引用符を書かない（hydration mismatch）。 */}
      <style>{`
        .preview-companies-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 1199px) { .preview-companies-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; } }
        @media (max-width: 600px)  { .preview-companies-grid { grid-template-columns: repeat(1, 1fr); gap: 8px; } }
      `}</style>
      <div className="preview-companies-grid">{children}</div>
    </>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>;
}

export default function CompanyCardsPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="企業カード（一覧）">
        <code>/companies</code> の <code>CompanyCardList</code> です。
        <strong>グリッド表示（compact）</strong>と<strong>リスト表示</strong>の2形態があります。
      </PreviewHeader>

      <Variant
        label="グリッド：項目が欠けている7社"
        note="⚠️★空の項目が「0名」「—」に化けないこと。カード高さが行内で揃うか（375px は1列なので揃わないのが既知）"
      >
        <Grid>
          {COMPANY_CARDS_MISSING.map((c) => <CompanyCardList key={c.id} company={c} compact />)}
        </Grid>
      </Variant>

      {/* ⚠️★2026-08-31 にこの画面で見つかった論点。**未対応**。
             リストカードは右端に「現役社員 / OB・OG / 募集中」の3つを
             **0でも必ず**出す（`StatCol` に 0 のときの分岐が無い）。
             実測（本番 `/companies?view=list`）: **40件中37件が「0 / 0 / 0」**。
             掲載79社で見ると **74社（94%）** が3つとも0。
             ⚠️ 値そのものは正しい（0人・0件は事実）ので、「値が無いのに既定値を出す」
                には当たらない。**出すかどうかは製品の判断**なので、勝手に変えていない。 */}
      <Variant
        label="リスト：項目が欠けている7社"
        note="⚠️★横カードは 0 でも「0名 現役社員 / 0名 OB・OG / 0件 募集中」を出す。本番でも40件中37件がこの形"
      >
        <List>
          {COMPANY_CARDS_MISSING.map((c) => <CompanyCardList key={`l-${c.id}`} company={c} />)}
        </List>
      </Variant>

      <Variant label="グリッド：長い社名・長いタグライン・タグ6個" note="⚠️ 折り返しと省略。カードが横に伸びないか">
        <Grid>
          {COMPANY_CARDS_LONG.map((c) => <CompanyCardList key={c.id} company={c} compact />)}
        </Grid>
      </Variant>

      <Variant label="リスト：長い社名・長いタグライン" note="⚠️ 1行に収まらないときの省略記号">
        <List>
          {COMPANY_CARDS_LONG.map((c) => <CompanyCardList key={`l-${c.id}`} company={c} />)}
        </List>
      </Variant>

      <Variant label="グリッド：12社（1ページぶん）" note="⚠️ tagline あり・なしが混ざる。行ごとに高さが揃うか">
        <Grid>
          {COMPANY_CARDS_12.map((c) => <CompanyCardList key={c.id} company={c} compact />)}
        </Grid>
      </Variant>

      {/* ★判断のための実データ再現（2026-08-31）。
             実測（掲載79社）: 0/0/0 が **74社**、値を持つのは5社だけ。
             ⚠️ ここは「不具合を見つける」ためではなく、**製品の判断材料**として置いている。 */}
      <Variant
        label="★リスト：本番と同じ分布（値を持つ5社 ＋ 0/0/0 が7社）"
        note="⚠️★本番では 0/0/0 が 74社続く。右端の「0名 / 0名 / 0件」が並ぶ見え方をここで判断してください"
      >
        <List>
          {COMPANY_CARDS_REAL_MIX.map((c) => <CompanyCardList key={c.id} company={c} />)}
        </List>
      </Variant>

      <div style={{
        marginTop: 8, padding: "12px 14px", borderRadius: 8,
        background: "#FFFBEB", border: "1px solid #FDE68A",
        fontSize: 12, color: "#92400E", lineHeight: 1.8,
      }}>
        ⚠️ <strong>これは不具合ではありません。</strong>0人・0件は事実で、
        「値が無いのに既定値を出す」には当たりません。
        <strong>出すかどうかは製品の判断</strong>なので、私（Claude）は変えていません。
        <br />
        変えるなら選択肢は3つ：
        <strong>①このまま</strong> ／
        <strong>②0のときはその列だけ出さない</strong>（残りは詰める）／
        <strong>③3つとも0なら列ごと出さない</strong>。
      </div>
    </div>
  );
}
