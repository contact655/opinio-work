import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { HeroSearch } from "./HeroSearch";
import { FinalCta } from "./FinalCta";
import { AuthAwareCta } from "./AuthAwareCta";
import { fmtMan } from "@/lib/utils/salary";
import { phaseLabel } from "@/lib/constants/phase";
import { LP_JOBS_MIN_TO_SHOW } from "@/lib/constants/landing";

/**
 * DATA セクション「経歴が構造化されている」に添えていた実画面。
 *
 * ⚠️★**2026-09-16 に定数ごと削除した**（`const CAREER_SHOT = null` と描画側の両方）。
 *    本文にしていた「経歴が構造化されている」カードを消したので、添える相手が無くなった。
 *    **記録としてこのコメントだけ残す**（画像ファイルは消していない。切り出し条件は下）。
 *    ⚠️ `next/image` の import も同時に落とした。戻すときは import から。
 *
 * ⚠️ 2026-08-05 に外した（null）。LP に個人が特定できる情報を載せない方針のため。
 *
 * ── なぜマスク版に差し替えなかったか ───────────────────────────────────────
 * ow_experiences には visibility_company（real / masked / hidden。2026-09-11 に1本化）があり、
 * masked はプロダクトの正規機能。ただし**マスクが差し替えるのは会社名・ID・ロゴだけ**で、
 * 役職名・部署名・在籍月・説明文（実績値を含む）はそのまま残る（timeline.ts:208）。
 *   例: 「兵庫県明石店 ウェルスマネジメント課 / 法人・個人営業」2017-04〜2021-10
 *       「FY26 Q1 達成率進捗105%」「Top Performance Club」
 * 会社名を伏せても業界内では特定に近づくため、マスク版では方針を満たせない。
 * 加えて、マスク後の社名生成は employee_count が数値前提だが実データは自由記述
 * （「単体6,425名 / グループ12,862名（2026年4月現在）」）なので規模も落ちる。
 *
 * ⚠️ 画像ファイルは消していない。参照を外しただけ。
 *      /images/lp/preview-career-v1.webp     （1168×1193。viewport 1440 で 700×715 を切り出し）
 *      /images/lp/preview-career-sm-v1.webp  （1088×1588。viewport 440 で 372×543 を切り出し）
 *    どちらも木村雅樹さんの職歴タイムライン。掲載許可は取得済みだが、
 *    再掲するなら「役職・部署・在籍月・実績が写らない切り出し」から作り直すこと。
 *
 * ⚠️ 戻すときは `.lp-trust-2` / `.lp-trust-wide` / `.lp-career-*` を使う
 *    （CSS は残してある）。上段2列＋経歴カード全幅（テキスト左・画像右）の形。
 */
/*
 * ═══ FV のプロダクト画像（2026-08-05 に外した）═══════════════════════════════
 *
 * 検索窓の直下に実画面を1枚置いていたが、FV は「見出し ＋ 検索窓」だけにする方針に
 * したため削除した。ProductShot ごと消してはいない（下記「戻すとき」を参照）。
 *
 * ⚠️ 画像ファイルは残してある。参照を外しただけ。切り出し条件は下に記録している。
 *
 * ── 募集検索（採用していたほう）──────────────────────────────────────────
 *   wide    preview-search-v3.webp     2500×1120  viewport 1250 の全幅
 *                                                （自前のヘッダーは含めない。
 *                                                  LP の実ヘッダーと二重に見えるため）
 *   mid     preview-search-md-v3.webp  1552×940   viewport 1140 の求人リスト列（776px）
 *   narrow  preview-search-sm-v2.webp   900×376   450px 相当
 *   alt     OPINIO の募集検索結果。職種・年収・勤務形態で絞り込め、各募集に年収レンジが表示されている。
 *   href    /jobs
 *
 * ── 企業ページの導入事例（候補どまり）────────────────────────────────────
 *   wide    preview-company-v3.webp     1860×1120  企業ページ本文列（930px）
 *   narrow  preview-company-sm-v2.webp   900×311
 *   alt     OPINIO の企業ページ。導入事例ごとに活用内容と成果が並んでいる。
 *   href    /companies
 *   ⚠️ mid は存在しない。こちらを使うなら先に作ること
 *      （/companies/[id] の導入事例を viewport 1140 前後で 776px 幅に切り出す）。
 *
 * ── 戻すとき ──────────────────────────────────────────────────────────────
 * ① ProductShot に wide / mid / narrow を渡して検索窓の下に置く
 * ② 表示幅を決める入れ物（旧 .lp-fv-shot = width:100%; max-width:1000px）を作る
 * ③ 注記「画面は実際のものです。掲載内容は変わることがあります。」を画像の下に置く
 *
 * ⚠️ 表示幅を変えるなら切り出しから作り直すこと。切り出し幅 c と表示幅 d は
 *    0.77 ≦ d/c ≦ 1.3 に収める（根拠と実測値は ProductShot.tsx のコメント）。
 *    v2（640〜660px）を 1000px で出そうとして 1.5倍に伸び、右端が文の途中で
 *    切れているのも露骨に出たのが v3 を切り直した理由。
 * ⚠️ 差し替えるときはファイル名の連番を上げること（v3 → v4）。
 *    Next の画像最適化は元パスをキーにするので、同名だと古いバイト列が配信され続ける。
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * ★「経歴が構造化されている」カードは **2026-09-16 に削除した。**
 *
 * 本文は「どこから来て、どこへ行ったか。…**企業単位でも職種単位でも辿れます**」だったが、
 * 実測すると**そういう画面が1つも無かった。**
 *
 *   ・未ログイン … `/u/[id]` `/people` `/people/role/[slug]` はすべて **307**。
 *                  企業ページの社員セクションも API が `authenticated:false` で
 *                  **件数だけ**を返す（個票0件）
 *   ・ログイン後 … 個人の年表（`/u/[id]`）は読めるが、
 *                  **「この会社の人がどこから来たか」を企業単位・職種単位で束ねた画面は無い**
 *
 * ⚠️★**この文言を戻さないこと。** 戻せるのは、集計画面が実在するようになってから。
 *    条件と必要件数は docs/phase0-top-page-20260916.md「フェーズ2向けのメモ」にある
 *    （前職が特定できる在籍者が **3人以上いる企業が0社**なので、まだ遠い）。
 *
 * ⚠️ `CAREER_SHOT`（実画面）は別物で、2026-08-05 から既に null。上のコメントを参照。
 */

// ─── Types ───────────────────────────────────────────────────────────────────
export type LPTotals = { companies: number; jobs: number };
export type LPFacet = { key: string; label: string; count: number; href: string };

export type LPCompanyCard = {
  id: string;
  /** リンク用。⚠️ `id`(UUID) で組むと 308 を1回挟む。`slug ?? id` で組むこと */
  slug: string | null;
  name: string;
  /** 主の事業領域名。⚠️ `industry`(text) ではない（廃止予定で新規企業では空になる） */
  businessDomain: string | null;
  phase: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  companyUrl: string | null;
  articleCount: number;
  jobCount: number;
};

export type LPJobCard = {
  id: string;
  title: string;
  companyName: string;
  jobCategory: string | null;
  /** 単位は万円（DB の salary_min/max がそのまま万円で入っている） */
  salaryMin: number | null;
  salaryMax: number | null;
  location: string | null;
  employmentType: string | null;
  remoteStatus: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────
const C = {
  paper:  "#FBFAF6",
  paper2: "#F2F1EA",
  navy:   "#0E2148",
  ink:    "#16202F",
  /**
   * 補助テキスト・ラベル・タグに使う色。
   *
   * ⚠️ WCAG AA 違反の修正ではない。2026-08-03 に LP の全282テキスト要素を実測したところ、
   * AA (4.5:1) を割る箇所は 0件 で、最低値でも 5.08:1 だった（旧色 #5A6779）。
   * それでも濃くしているのは、日本語ゴシックが欧文サンセリフより線が細く見え、
   * 欧文基準で選んだトーンだと同じコントラスト比でも薄く感じられるため。
   * WCAG は画数の多い日本語を想定していないので、比率だけでは判断できない。
   *
   * 2026-08-03 に #5A6779 → #47546B（AAA 到達）に上げたが、実機ではまだ薄く見えた。
   * 同日さらに #3D4759 まで一段濃くしている（比率ではなく見た目で判断）。
   * 本文 ink(#16202F) との差はまだ十分あり、階層は潰れていない。
   *
   * → AA で測って「問題ないのになぜ濃いのか」と薄く戻さないこと。
   */
  muted:  "#3D4759",
  line:   "#E5E5DF",
  blue:   "#2D5BD8",
  green:  "#0E6B4F",
};

/**
 * 人物帯（その転職を、すでにした人）は Career Agent へ移設するため非表示。
 * データと表示ロジックは lpGuestMembers.ts に残してあるので、
 * 移設先で再利用するか、方針が変わればここを true に戻せば復帰する。
 */
const SHOW_PEOPLE_BAND = false;

const REMOTE_LABEL: Record<string, string> = {
  full_remote: "フルリモート",
  hybrid: "ハイブリッド",
  on_site: "出社",
};

/* ★フェーズのラベルは [lib/constants/phase.ts](@/lib/constants/phase) の
      `phaseLabel()` を使う（2026-09-16）。**ここに語彙を持たない。**

   ⚠️★ここには 2026-09-16 まで**独自の9キーのテーブル**があった。
      `startup` / `listed_prime` / `listed_standard` / `listed_growth` /
      `listed_overseas` の5値が抜けており、しかも未知の値を**生のまま返して**いたので、
      株式会社Opinio のカードに **「HR・人材 ／ startup」** と英語が出ていた。
      `stageCfg.ts` は 2026-09-06 に同じ理由で独自テーブル（30キー）を捨てている。
      **LP だけ寄せ忘れていた。**

   ⚠️ `phaseLabel()` は**未知の値に null を返す**。生値が漏れる経路はもう無い
      （CLAUDE.md「値が無いことを、ある値に置き換えない」）。 */

function salaryText(min: number | null, max: number | null): string | null {
  if (min && max) return `${fmtMan(min)}〜${fmtMan(max)}万円`;
  if (min) return `${fmtMan(min)}万円〜`;
  if (max) return `〜${fmtMan(max)}万円`;
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LandingPage({
  totals,
  industryFacets,
  schoolFacets,
  companies,
  jobs,
  scoutSendingEnabled,
}: {
  totals: LPTotals;
  industryFacets: LPFacet[];
  /** 出身校。出身業界は前職のマスタ紐付けが必要で現状ほぼ取れないため未実装 */
  schoolFacets: LPFacet[];
  companies: LPCompanyCard[];
  jobs: LPJobCard[];
  /** ★スカウト送信が開いているか。⚠️ ここで env を読まない（`isScoutSendingEnabled()` を
   *  `page.tsx` が呼んで渡す）。判定を画面ごとに書き写さないため。 */
  scoutSendingEnabled: boolean;
}) {
  // font-family は globals.css の body と同じ順序にする。
  // 欧文・数字は Inter、和文は Noto Sans JP（Inter に和文グリフが無いので自動で振り分けられる）。
  // ⚠️ next/font のファミリ名はビルドごとに変わるので必ず CSS 変数で参照すること。
  //    リテラルの "Noto Sans JP" は next/font のフォントに当たらず OS フォールバックに落ちる。
  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: 'var(--font-inter), var(--font-noto), -apple-system, BlinkMacSystemFont, sans-serif', WebkitFontSmoothing: "antialiased", lineHeight: 1.8 }}>
      <style>{`
        .lp-wrap { max-width: 1120px; margin: 0 auto; padding: 0 28px; }
        .lp-section { padding: 72px 0; }
        .lp-h2 { font-size: clamp(22px, 2.4vw, 30px); font-weight: 800; line-height: 1.45; color: ${C.navy}; letter-spacing: -0.01em; }
        /* 見出しの中で塊を作って折り返しを固定する。⚠️ 使うのは span を置いた見出しだけ。 */
        .lp-h2 span { display: inline-block; }
        .lp-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .14em; color: ${C.blue}; margin-bottom: 10px; }
        .lp-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 26px; }

        .lp-facets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .lp-facet { display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
                    background: #fff; border: 1px solid ${C.line}; border-radius: 10px;
                    padding: 12px 14px; text-decoration: none; }
        .lp-facet:hover { border-color: ${C.blue}; }

        .lp-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        /* ★カードの高さを行内で揃える（2026-09-17）。
           ⚠️ min-height ではなく Grid の行内 stretch で揃える。
              /companies のカードと同じやり方（CLAUDE.md ④「下端が揃う仕組みは minHeight ではない」）。
              固定値を置くと、事業領域の名前が長い企業だけ溢れる。
           ⚠️ align-items を center や start にしないこと。stretch（既定）で揃う。
           ⚠️★この style タグの中にバッククォートを書かないこと（同日2回踏んだ）。 */
        .lp-card { background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 20px; text-decoration: none; display: block; height: 100%; }
        .lp-card:hover { border-color: ${C.blue}; box-shadow: 0 6px 20px rgba(14,33,72,.07); }

        .lp-jobs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }

        /* 在籍者向けの2枚。⚠️ 3枚に増やさないこと（裏が取れているのは2つだけ） */
        .lp-member-points { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

        /* FV のサブコピー。検索窓（1000px）より内側に収める。
           ⚠️ fontSize と margin はここで持つこと。インラインに書くと下の
              メディアクエリが効かなくなる（CLAUDE.md「インラインstyle と CSS の優先順位」）。
           span を inline-block にしているのは、折り返しを句の境目に固定するため。 */
        .lp-hero-sub { font-size: 15.5px; line-height: 1.7; color: ${C.muted};
                       margin: 0 0 26px; max-width: 900px; }
        .lp-hero-sub span { display: inline-block; }
        /* 見出しも句の境目で折る。⚠️ 理由はすぐ上の lp-hero-sub span と同じ。
           ⚠️★この style タグの中にバッククォートを書かないこと。テンプレートリテラルが
              その場で閉じる（.claude/rules/ui-debugging.md ⑲①。2026-09-17 に実際に踏んだ）。 */
        .lp-hero-h1 span { display: inline-block; }

        /* 検索窓の下のボタン。⚠️ 窓（1000px）の中で中央に置く。
           ⚠️ flex-wrap を外さないこと。375px では2段になる。 */
        .lp-hero-cta { display: flex; flex-wrap: wrap; justify-content: center;
                       gap: 12px; margin-top: 22px; }
        .lp-hero-btn { display: inline-flex; align-items: center; justify-content: center;
                       padding: 13px 24px; border-radius: 8px; font-size: 14.5px;
                       font-weight: 700; text-decoration: none; white-space: nowrap; }
        .lp-hero-btn-solid { background: ${C.navy}; color: #fff; }
        .lp-hero-btn-ghost { background: #fff; color: ${C.navy}; border: 1px solid ${C.line}; }
        .lp-hero-btn-ghost:hover { border-color: ${C.navy}; }

        .lp-trust { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: start; }
        /* 経歴カードに画面を入れるときだけ、上段を2列にして経歴を全幅の行に出す。
           3列のまま1枚だけ縦長画像を入れると、そのカードだけ約600pxになり
           他の2枚（159px）との間に440pxの空白ができる（align-items: start なので
           カードは引き伸ばされず、下に伸びるだけ）。
           全幅にしてカード内をテキスト左・画像右に組むと、その空白が消える。 */
        .lp-trust-2 { grid-template-columns: repeat(2, 1fr); margin-bottom: 18px; }
        .lp-trust-wide { display: grid; grid-template-columns: 1fr 584px; gap: 32px; align-items: center;
                         background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 24px; }
        .lp-trust-wide img { width: 100%; height: auto; display: block;
                             border: 1px solid ${C.line}; border-radius: 8px; }
        /* 画面幅で画像そのものを差し替える。ProductPreview の .pp-wide / .pp-narrow と同じ理由。
           wide は 700px幅の切り出しなので、表示幅が 540px を下回ると本文が読めなくなる。
           620px 未満では 372px幅で撮り直した narrow に切り替える。
           CSS の縮小では解決しない（元の情報量が多すぎる）ので画像を分けている。 */
        .lp-career-wide { display: block; }
        .lp-career-narrow { display: none; }
        /* .pp-* は globals.css 側にある。
           空文字を指定する content の引用符が、Server Component の style タグでは
           実体参照にエスケープされ、raw text 要素なのでブラウザが復元しないため。
           この style タグの中には引用符・大なり・小なりを書かないこと。 */

        @media (max-width: 900px) {
          .lp-section { padding: 52px 0; }
          .lp-wrap { padding: 0 18px; }
          .lp-facets { grid-template-columns: repeat(2, 1fr); }
          .lp-cards, .lp-jobs, .lp-trust, .lp-member-points { grid-template-columns: 1fr; }
          /* 狭い画面では経歴カードも縦積みにする（画像はテキストの下）。
             620px までは wide の切り出しのまま。ここでは表示幅が 600px 前後あり、
             縮小率 0.85 で本文が読める。 */
          .lp-trust-2 { grid-template-columns: 1fr; }
          .lp-trust-wide { grid-template-columns: 1fr; gap: 20px; }
          /* プレビューは1カラムだと縦に伸びすぎるので6枚までに絞る。
             2026-09-16 に見出しの「N社すべて見る」から件数を外したので、
             ここで隠した残りの枚数はどこにも出ない。それでよい
             ——このセクションは在庫の量ではなく、どんな会社が載るかを見せる場所。 */
          /* 子結合子（大なり記号）は使わないこと。Server Component 内の style タグでは
             React がサーバー出力で実体参照にエスケープするが、style は raw text 要素のため
             ブラウザが復元せず、SSR 時点でセレクタが壊れる（hydration mismatch も出る）。
             同じ理由で、この中に大なり・小なり・引用符を書かないこと。
             nth-child は元々親基準なので、子クラス指定で足りる。 */
          .lp-cards .lp-card:nth-child(n+7), .lp-jobs .lp-card:nth-child(n+7) { display: none; }
        }
        /* 経歴の画像だけ 620px で切り替える。レイアウトの折り返し（900px）とは別の境目。
           900px はカードが縦積みになる点、620px は wide の切り出しが読めなくなる点。 */
        @media (max-width: 620px) {
          .lp-career-wide { display: none; }
          .lp-career-narrow { display: block; }
        }
        details summary::-webkit-details-marker { display: none; }
        details summary::marker { display: none; }
        details[open] summary .lp-faq-arrow { transform: rotate(90deg); }
        .lp-faq-arrow { transition: transform .2s; }
      `}</style>

      {/* ══ HERO — 検索が主役 ═══════════════════════════════════════════════ */}
      <section style={{ borderBottom: `1px solid ${C.line}`, padding: "64px 0 56px" }}>
        <div className="lp-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {/*
            FV は 見出し・サブコピー・検索窓の3要素。
            アイブロウ / 注記 / 件数バッジは置かない。
              ・アイブロウ（旧「IT・SaaS特化」）はサブコピーと内容が重なるので戻さない
              ・件数は各セクションの「N社すべて見る」で示す（eab6d71d の方針）
              ・注記はサブコピーと同趣旨になり、52ad822b で重複を理由に消したもの

            ⚠️「IT」という対象業界は、いまサブコピーと検索窓のプレースホルダーの
               2箇所で言っている。
               2026-08-04 まで「プレースホルダーにしか書いていないので短くしないこと」
               という制約を置いていたが、これは見出しが英語だった時期（059c964b）の
               前提であり、日本語見出しに戻し（1e21acb9）サブコピーも戻した
               2026-08-05 現在は成立しない。
               ⚠️ ただしプレースホルダーを短くしてよいと決めたわけではない。
                  変えるかどうかは別途判断する。

            ⚠️ 2026-08-04: 英語見出し「The full picture, before you apply.」から戻した。
               ① apply（応募）が転職を前提にしており、「転職を前提にしない」という
                  プロダクトの方針と矛盾していた。見出しで応募を前提に置くと、
                  情報収集の段階にいる人を最初の一画面で締め出すことになる
               ② 無名ブランドの英語見出しは日本市場で意味伝達が弱い。
                  英語見出しが機能するのは、読み手が既にブランドを知っていて
                  「雰囲気」として受け取れる場合に限られる
               英語に戻すなら上の2点をどう解くかを先に決めること。

            和文なので letter-spacing を軽く詰める（英語では詰めていなかった）。

            ⚠️ 2026-08-05: 上限を 62px から 44px に下げた（約71%）。
               62px だと見出しの幅が約610pxで、当時700pxだった検索窓とほぼ並び、
               FV で先に目に入るのが見出しになっていた。検索を主役にするため、
               見出しを下げ、窓を1000pxに広げて幅の主従を逆転させている。
               ⚠️ 下限の 34px は動かさないこと。モバイルの見え方を変えないための下限で、
                  375〜1060px の範囲ではこの値が効いている（3.2vw が 34px を超えるのは
                  約1063px から）。
          */}
          {/* ⚠️ span は inline-block（`.lp-hero-h1 span`）。**折り返しを句の境目に固定するため。**
                 375px では1行に収まらないので、必ず「会社を、／そこで働く人から知る。」で折る。
                 ⚠️ 読点で切っただけでは足りない —— 塊にしないと「そこで働く人から知／る。」になる。 */}
          <h1 className="lp-hero-h1" style={{ fontSize: "clamp(30px, 3.0vw, 42px)", fontWeight: 800, lineHeight: 1.35, letterSpacing: "-0.02em", color: C.navy, marginBottom: 14 }}>
            <span>会社を、</span>
            <span>そこで働く人から知る。</span>
          </h1>

          {/*
            見出しは「何を確かめるのか」を言っていないので、ここで対象を名指しする。
            52ad822b で「合意版」として置かれ、9ac31983 で要素数を絞るために
            消えていた1行を戻したもの（2026-08-05）。文言は変えていない。

            ⚠️ 読点で折らないこと。inline-block の塊にしてあるので、
               折り返しは必ず「・」ではなく塊の境目で起きる。
               2文字だけが2行目に落ちる事故（008bd220 の「か。」）を防ぐため。

            ⚠️ 「経歴まで」と書いているが、未ログインで到達できる経歴は現状ゼロ
               （実ユーザーは全員 ow_users.visibility = login_only）。
               「〜まで」はデータの範囲を述べていて無料で読めるとは約束していないので
               嘘ではないが、FV は一番強い場所なので可視性の整理が済んだら見直すこと。
          */}
          {/*
            ★2文とも実測で裏を取ってある（2026-09-17 に再確認）。**数字を書かずに事実だけを言う。**

            1文目「IT企業の事業と、…経歴をまとめています」
              ⚠️★**「事業」までにしてある。**「組織体制・働き方まで」と書かないこと。
                 実測（掲載22社）では `description` 22社に対し、
                 組織体制 1社 / 働き方（`remote_work_status`）1社 / 福利厚生 1社しかない。

            2文目「経歴は登録すると読めます」
              実測（2026-09-17 / 本番）: 公開企業のうち**5社**に、
              ログイン後に読める在籍者・元在籍者が**5名**いる（掲載中に限ると3社）。
              ログイン済みの一般アカウントで企業ページの社員セクションから `/u/[id]` を開き、
              会社・部署・役職・在籍期間・説明まで読めることを確認済み。
              ⚠️★**未ログインでは1行も見えない**（`/u/` `/people` は middleware で 307）。
                 だから「登録すると」を落とさないこと。落とすと嘘になる。
              ⚠️ **人数は薄い。** 数を書かないのはそのためでもある。
          */}
          <p className="lp-hero-sub">
            {/* ⚠️ span は inline-block。**折り返しを句の境目に固定するため**で、
                   読点で折るためではない（CLAUDE.md「2文字だけが2行目に落ちる事故」）。
                   3つ目を分けていないと、375px で「見られ／ます。」と割れる（実測）。 */}
            <span>IT企業の事業と、</span>
            <span>在籍している方・していた方の</span>
            <span>経歴をまとめています。</span>
            <span>経歴は登録すると読めます。</span>
          </p>

          <HeroSearch navy={C.navy} line={C.line} muted={C.muted} paper2={C.paper2} />

          {/*
            ★検索窓の下のボタン2つ（2026-09-16）。

            ⚠️★**「自分の経歴で調べる」にしないこと。** 指示書の初案にあったが、
               **自分の経歴を条件に検索する機能は存在しない。** 画面に書く主張は
               コードで裏が取れたものだけにする、という本件の基準に反する。
               登録して実際に増えるのは「在籍者の経歴が読める」ことなので、そう書く。
            ⚠️ 最終CTA と同じ行き先だが、**FV から一度も下までスクロールしない人**が
               いるので重複させている。文言は最終CTA と揃えること。
          */}
          <div className="lp-hero-cta">
            <Link href="/companies" className="lp-hero-btn lp-hero-btn-solid">企業から見る</Link>
            {/* ⚠️★登録済みの人に「無料登録」を出さない（`FinalCta` と同じ理由）。
                   `member` を `null` にしてあるので、**ログイン済みではボタンごと消える**
                   ——FV に2つ並べる意味は「まだ登録していない人に登録の理由を見せる」ことなので、
                   済んでいる人には左の「企業から見る」だけで足りる。 */}
            <AuthAwareCta
              className="lp-hero-btn lp-hero-btn-ghost"
              /* ⚠️ 最終CTA（`FinalCta`）と**同じ文言**にしてある。片方だけ変えないこと。 */
              guest={{ href: "/auth", label: "無料登録して経歴を見る" }}
              member={null}
            />
          </div>
        </div>
      </section>

      {/* ══ ファセット ═══════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">BROWSE</div>
              {/* ⚠️★2026-09-17: 「業種から探す」から言い直した。
                     `/companies` の絞り込みチップは **2026-09-06 から「事業領域」**で、
                     「業種」は同ページに1件も出ていない（実測）。
                     ⚠️ 「業種」は `ow_industries` に使う語で、**別のマスタ**。混ぜないこと
                        （CLAUDE.md「事業領域と対象業界」）。
                     ⚠️ フッターの「事業領域から探す」とも揃った。**あちらは変えていない。** */}
              <h2 className="lp-h2">事業領域から探す</h2>
            </div>
            <Link href="/companies" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap" }}>
              すべての条件で絞り込む →
            </Link>
          </div>

          {/*
            ⚠️★**件数を出さないこと（2026-09-16）。** タイルは残す。
               実測（2026-09-16）では 11タイルの件数が **1〜4** で、
               押す前に在庫の薄さを自分から見せる形になっていた。
            ⚠️ **`f.count` を捨てたわけではない。** `getBusinessDomainFacets()` は
               **掲載中の企業が1社以上あるものだけ**を返すので、
               ここに並ぶタイルは全部「押せば1件以上ある」。
               ⚠️ だから **`getBusinessDomainFacets()` を
                  `getBusinessDomainOptions()`（マスタ全件）に替えないこと。**
                  替えると 0件のタイルが混ざり、件数を消したぶん**押すまで気づけない**。
          */}
          <div className="lp-facets">
            {industryFacets.map((f) => (
              <Link key={f.key} href={f.href} className="lp-facet">
                <span style={{ fontSize: 13.5, fontWeight: 500, color: C.ink }}>{f.label}</span>
                <span aria-hidden style={{ fontSize: 13, color: C.muted, flexShrink: 0 }}>›</span>
              </Link>
            ))}
          </div>

          {/* 「フェーズから探す」は 2026-08-03 に削除。業種と並べる軸としては粒度が粗く、
              LP の導線を業種ひとつに絞った。フェーズでの絞り込みは /companies 側に残っている。 */}
        </div>
      </section>

      {/* ══ 企業インデックス ══════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">COMPANIES</div>
              <h2 className="lp-h2">ピックアップ企業</h2>
            </div>
            {/* ⚠️★件数を出さない（2026-09-16）。「22社すべて見る」は在庫の薄さを
                   自分から見せる形だった。⚠️ `totals.companies` は
                   **この行では使わない**が、props からは外していない
                   （数えるのをやめたわけではなく、出すのをやめただけ）。 */}
            <Link href="/companies" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap" }}>
              企業を見る →
            </Link>
          </div>

          <div className="lp-cards">
            {companies.map((c) => (
              <Link key={c.id} href={`/companies/${c.slug ?? c.id}`} className="lp-card">
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <CompanyLogo
                    name={c.name}
                    logoUrl={c.logoUrl}
                    logoLetter={c.logoLetter}
                    logoGradient={c.logoGradient}
                    companyUrl={c.companyUrl}
                    size="sm"
                  />
                  <div style={{ minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 15, fontWeight: 700, color: C.navy, lineHeight: 1.45 }}>{c.name}</b>
                    {/* 淡色(muted)を 12px で使うので weight 600。12px 未満は作らない */}
                    <small style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted }}>
                      {[c.businessDomain, phaseLabel(c.phase)].filter(Boolean).join(" ／ ") || "—"}
                    </small>
                  </div>
                </div>
                {/*
                  ⚠️★カード下段（区切り線と「記事 N」「求人 N」）は **2026-09-17 に外した。**

                     ・**12枚中5枚にしか出ていなかった**（残り7枚は2項目とも0で行ごと消える）。
                       出る枚数のほうが少ないので、揃っていないことのほうが目に付いていた
                     ・**カードの高さが不揃いになる原因**でもあった（行の有無で約37px 差）
                     ・そもそも件数は 2026-09-16 にファセット・見出し・metadata から外した。
                       ここだけ残っているのがちぐはぐだった

                  ⚠️★**`articleCount` / `jobCount` は残してある。** `LPCompanyCard` の型にも
                     `page.tsx` の集計にもある。戻すならここに1ブロック足すだけでよい。
                     ⚠️ 戻すときは「0 は出さない」を守ること（2026-08-05 の判断）。
                  ⚠️ 「社員」は 2026-08-05 に外した。理由は pickCompanies.ts のコメント参照。
                */}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 求人インデックス ══════════════════════════════════════════════════
          ★公開求人が `LP_JOBS_MIN_TO_SHOW` 件未満のあいだは**セクションごと出さない**
            （2026-09-16）。実測: 公開求人 **2件**・持っている企業は **1社だけ**。
            「2件すべて見る →」は在庫の薄さを最初に自分から見せる形だった。

          ⚠️ **「数を隠さない」方針と矛盾しない。**「表示する値を偽らない」ことと
             「セクションを出すかどうか」は別の判断で、ここは後者
             （出身校ファセットの SCHOOL_MIN_SCHOOLS と同じ考え方）。

          ⚠️★**`/jobs` への導線は消えない。** ヘッダーの「募集」、フッターの
             「募集を探す」、モバイルメニューの「募集一覧」の3箇所に残る
             （2026-09-16 実測）。**この3つを外すときはここを思い出すこと。**

          ⚠️ しきい値は [lib/constants/landing.ts](@/lib/constants/landing)。
             在庫が増えれば自動で表示される。**出ていないのはバグではない。** */}
      {totals.jobs >= LP_JOBS_MIN_TO_SHOW && (
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">JOBS</div>
              <h2 className="lp-h2">募集中の求人</h2>
            </div>
            <Link href="/jobs" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap" }}>
              募集を見る →
            </Link>
          </div>

          <div className="lp-jobs">
            {jobs.map((j) => {
              const salary = salaryText(j.salaryMin, j.salaryMax);
              const meta = [
                salary,
                j.location,
                j.remoteStatus ? REMOTE_LABEL[j.remoteStatus] ?? null : null,
                j.employmentType,
              ].filter(Boolean) as string[];
              return (
                <Link key={j.id} href={`/jobs/${j.id}`} className="lp-card">
                  <b style={{ display: "block", fontSize: 15, fontWeight: 700, color: C.navy, lineHeight: 1.5, marginBottom: 4 }}>
                    {j.title}
                  </b>
                  <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: C.ink, marginBottom: 10 }}>{j.companyName}</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {meta.map((m, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 12, padding: "3px 9px", borderRadius: 999,
                          background: i === 0 && salary ? "#ECFDF5" : C.paper2,
                          color: i === 0 && salary ? C.green : C.muted,
                          fontWeight: i === 0 && salary ? 700 : 600,
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {/* ══ 人から探す ═══════════════════════════════════════════════════════
          出身業界（前職の業種）は前職がマスタ企業に紐づいている必要があり、
          現状ほぼ取得できないため今回は出さない。紐付けが進んだら軸を足す。 */}
      {schoolFacets.length > 0 && (
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">PEOPLE</div>
              <h2 className="lp-h2">人から探す</h2>
              <p style={{ fontSize: 14.5, color: C.muted, marginTop: 8 }}>
                自分と近い経歴の人が、どの会社にいるか。
              </p>
            </div>
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, marginBottom: 10 }}>出身校から</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {schoolFacets.map((s) => (
              <Link
                key={s.key}
                href={s.href}
                style={{
                  display: "inline-flex", alignItems: "baseline", gap: 8,
                  background: "#fff", border: `1px solid ${C.line}`, borderRadius: 999,
                  padding: "9px 16px", fontSize: 13.5, color: C.ink, textDecoration: "none",
                }}
              >
                {s.label}
                <strong style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, fontWeight: 700, color: C.navy }}>{s.count}</strong>
              </Link>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* 使い方（HOW IT WORKS / 探して、比べて、決める）は 2026-08-05 に削除した。
          内容が汎用的で OPINIO でなくても書ける説明だったため。説明を1ブロックに絞るなら、
          他社が言えない内容を持つ DATA セクションを残すほうが筋が通る。
          ここにあった実画面2枚のうち1枚は FV の検索窓の直下に移した（FV_SHOT）。 */}

      {/* ══ データの出どころ ══════════════════════════════════════════════════ */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">DATA</div>
              <h2 className="lp-h2">このデータは、どこから来ているか</h2>
            </div>
          </div>
          <div className="lp-trust">
            {[
              // ⚠️ 「企業情報を独自に作成している」に実画面を添えていたが 2026-08-04 に外した。
              //    カード幅342px・画像292pxでは、文字が読める切り出し幅の上限が380pxしかなく、
              //    導入事例1件の左半分（読める数字は1つ）しか入らないため。
              //    2026-08-05 に再検証しても同じで、既存の preview-company-v2.webp は
              //    518px表示用の切り出しなので295pxでは成果の数字が潰れる。
              //    ここに画像を戻すなら、もっと寄った別の切り出しが要る。
              {
                /* ⚠️ 見出しは 2026-09-17 に「企業情報を独自に作成している」から言い直した。
                      本文が「公開情報をもとに整理しています」なので、見出しの
                      「独自に作成」と食い違っていた。**本文は変えていない。** */
                title: "公開情報をもとに整理している",
                /* ⚠️★2026-09-16: 末尾の「**事業内容・組織体制・働き方まで揃えています**」を
                      削除した。実測（掲載22社）で `description` 22社に対し、
                      **組織体制 1社 / 働き方 1社 / 福利厚生 1社**しか無く、ほぼ事実でなかった。

                   ⚠️★2026-09-16: 前半も直した。以前は「**web から自動で集めたものではなく**」
                      だったが、**言い切れない。** 企業データの一部は公開情報から
                      機械的に埋めている（CLAUDE.md「capital_type / branch_locations は
                      公開情報から機械投入であり、取材データではない」）。
                      → 「**公開情報をもとに整理している**」という事実の範囲に寄せた。

                   ⚠️ 「OPINIO が整理しています」の裏取り（2026-09-16 / migration と scripts を確認）:
                        ・**テキストデータを取得するスクリプトは存在しない。**
                          `scripts/` で `ow_companies` を触るのはロゴ画像の移行と
                          テスト企業の location 分散だけ。`open-graph-scraper` は
                          利用者が貼った URL の OGP 取得用で、企業データには使っていない
                        ・一括投入の migration はあるが、いずれも**1社ずつ値を明示列挙**した形
                          （例: `20260728065124` は57社の資本関係を id + 親会社名 + 国で列挙し、
                          「個社調査が必要」な項目は**意図的に外している**）
                        ・`20260906130000` は「**1社ずつ調べた値だけを入れている**」と書き、
                          証券コード・上場日・リリース日まで残したうえで、
                          ラウンドが特定できない社には親（`startup`）を入れている
                        ・**確認なしの一括投入は、見つかった分は除去済み**
                          （`remote_work_status='hybrid'` 64社 → `20260727182605` で NULL、
                          `avg_salary` → `20260811172511` で NULL）

                   ⚠️★後半は**一度「出典は項目ごとに記録しています」と書いて、同日に直した。**
                      仕組み（`ow_company_data_sources` / `lib/constants/companySources.ts` /
                      `/admin/companies/coverage`）は実在するが、**記録があるのは2項目だけ**。
                      実測（2026-09-16 / 掲載22社）:

                        headquarters_address … 21/21（値のある全社。うち1社は source_kind=unknown）
                        phase                … 1/22
                        他13項目（description / employee_count / founded_year / tagline /
                                  url / capital_type / parent_company_name / main_products /
                                  ceo_name / nearest_station / branch_locations /
                                  customer_cases / main_customers）… **すべて 0件**

                      画面に出す項目×社の「埋まっているマス」227 に対し、出典があるのは **22**（約1割）。
                      ⚠️★**したがって「出典は項目ごとに記録しています」と書かないこと。**
                         一度書いて同日に外した。
                      ⚠️★**出典記録の進み具合も本文に書かない**（2026-09-16 / 柴さんの判断）。
                         運営の作業の進捗であって、訪問者向けの情報ではない。
                         実測値はこのコメントに残してあるので、次に触る人は数え直さずに済む。
                   ⚠️★**項目名を書き足さないこと。** 足すなら先に充填率を数え直す。 */
                body: "掲載企業の情報は、公式サイトや登記などの公開情報をもとに、OPINIO が整理しています。",
              },
              // ⚠️ 2026-08-04 まで「所属が認証されている / 本人が名乗っているのではなく
              //    企業側が在籍を確認しています」と書いていたが、事実と正反対だったため差し替えた。
              //    実測: 公開中の所属4件はすべて invited_at / invited_by が空で、
              //    企業側の招待フローを通っていない（運営が直接作った行）。
              //    ドメイン認証済みの企業も 85社中0社。所属は自己申告である。
              //    企業側の確認フローが実際に回り始めるまで、認証を主張しないこと。
              /* ⚠️ 実測（2026-09-16）: 掲載22社のうち**公開求人を持つのは1社だけ**。前半は事実。
                    ⚠️★末尾の「事業や**組織**を先に調べておけます」から「組織」を外した。
                       `org_teams` を持つのは掲載22社中 **1社**で、上のカードから
                       「組織体制まで揃えています」を削除したのと同じ理由。 */
              { title: "募集を出していない企業も載っている", body: "求人の有無にかかわらず企業ページを作っています。いま募集がない会社も、どんな事業をしているのかを先に調べておけます。" },
              /* ⚠️★3枚目（「経歴が構造化されている」）は 2026-09-16 に削除した。
                    理由は上の CAREER_CARD 跡のコメント。**戻さないこと。**
                    代わりに「登録すると何が読めるか」を FAQ と在籍者向けセクションで言う。 */
              {
                title: "登録した人の経歴が載っている",
                /* ⚠️★実測（2026-09-16）で裏を取った範囲だけを書く。
                      ログイン済みの一般アカウントで企業ページの社員セクションから
                      `/u/[id]` を開き、会社・部署・役職・在籍期間・説明まで読めることを確認。
                   ⚠️ **件数を書かないこと。** 掲載22社のうち3社・実人数4名しかいない。
                   ⚠️★**「辿れます」「分析できます」と書かないこと。**
                      束ねて見る画面は無い（1人ずつ読む）。 */
                body: "在籍している方・在籍していた方が、自分で職歴を登録しています。ログインすると、その会社で誰がどんな仕事をしてきたかを読めます。",
              },
            ].map((t) => (
              <div key={t.title} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 9 }}>{t.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0 }}>{t.body}</p>
              </div>
            ))}
          </div>

          {/* ⚠️★経歴カードに実画面を添える全幅の行（`CAREER_SHOT`）は
                 **2026-09-16 に削除した。** 本文にしていた `CAREER_CARD` を消したため、
                 参照だけが残って `tsc` が落ちる状態になっていた。
                 戻すときの手順は `CAREER_SHOT` 跡のコメントと `.lp-trust-wide` を読むこと
                 （CSS・画像ファイル・`.lp-career-*` は残してある）。 */}
        </div>
      </section>


      {/* ══ 在籍者向け ═══════════════════════════════════════════════════════
          ★経歴を「載せる側」に向けた唯一のセクション（2026-09-16 追加）。
            それまで LP は探す人にしか語りかけておらず、**経歴が集まらないと
            上の「登録した人の経歴が載っている」が育たない**という構造だった。

          ⚠️★**項目は2つだけ。** 3つ目の案「話すかどうかも自分で決められる」は
             **削除した。裏が取れなかったため。**
             `POST /api/dm/start` が見るのは `ow_users.visibility` **だけ**で、
             `career_stance`（転職についての意思表示）も面談対応可の設定も参照していない。
             `/u/[id]` の「メッセージ」ボタンは**ログイン済みの非オーナー全員**に出る。
             ＝ 本人の意思表示に関わらず DM は届く。
             ⚠️ 論点としては docs/todo.md に残してある。**実装より先に文言を書かないこと。**

          ⚠️ 2つとも実測の裏がある:
             ① 公開範囲 … `ow_users.visibility` の3択（公開 / ログインユーザーのみ / 非公開）。
                          `/mypage/settings` にラジオが実在。文言の出どころは
                          `lib/constants/profileVisibility.ts` の1箇所
             ② 勤め先 … `can_send_scout()` の条件2（company_id 一致）と条件2b
                        （**自由入力の社名も `normalize_company_name` で一致**）。
                        `/biz/candidates` は `canSendResults[i] === true` で
                        **一覧そのもの**を絞るので、候補者として出てこない
          ⚠️★②は「**採用担当の候補者検索**」に限った話。**言い切りを広げないこと。**
             その企業の**企業ページの現役社員**には出る（そちらは本人の公開範囲で決まる）。 */}
      <section className="lp-section">
        <div className="lp-wrap" style={{ maxWidth: 880 }}>
          <div className="lp-eyebrow">FOR MEMBERS</div>
          {/* ⚠️ span は inline-block（`.lp-h2 span`）。**「ます」だけが2行目に落ちていた**
                 （2026-09-17 実測）。句の境目で折る。 */}
          <h2 className="lp-h2" style={{ marginBottom: 12 }}>
            <span>転職を考えていなくても、</span>
            <span>あなたの経歴は</span>
            <span>誰かの判断材料になります</span>
          </h2>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.8, margin: "0 0 26px" }}>
            どこから来て、なぜいまの会社を選んだか。その事実が、次に同じ道で迷う人の助けになります。
          </p>

          <div className="lp-member-points">
            {[
              {
                title: "公開する範囲は自分で決められる",
                body: "「公開」「ログインユーザーのみ」「非公開」から選べます。初期設定はログインユーザーのみで、検索エンジンには出ません。",
              },
              {
                title: "いまの勤め先の採用担当の候補者検索には表示されない",
                body: "在籍中として登録した会社からは、あなたを候補者として見つけられません。会社名を自由入力で書いた場合も同じです。",
              },
            ].map((t) => (
              <div key={t.title} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 22 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, color: C.navy, marginBottom: 8, lineHeight: 1.5 }}>{t.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0 }}>{t.body}</p>
              </div>
            ))}
          </div>

          {/* ⚠️★ログイン済みの人には `/auth` を出さない。職歴を足す場所は `/mypage`
                 （職歴・学歴は行の鉛筆で編集する。2026-09-12 に一覧ページを畳んだ）。
              ⚠️ `/mypage/details/experience` を指さないこと。**middleware が `/mypage` へ転送する。** */}
          <div style={{ marginTop: 24 }}>
            <AuthAwareCta
              className="lp-hero-btn lp-hero-btn-solid"
              guest={{ href: "/auth", label: "経歴を載せる" }}
              member={{ href: "/mypage", label: "経歴を追加する" }}
            />
          </div>
        </div>
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ marginBottom: 26 }}>
            <div className="lp-eyebrow">FAQ</div>
            <h2 className="lp-h2">よくあるご質問</h2>
          </div>
          <div style={{ borderTop: `1px solid ${C.line}` }}>
            {[
              /* ⚠️★2026-09-16 に書き直した。**登録すると実際に使えるものだけを書く。**
                    前の答えは「登録は、気になる企業を保存したり、**新しい求人が出たときに
                    通知を受け取る**ためのものです」だったが、**求人の通知は存在しない**
                    （週次メールは `vercel.json` の crons が空 ＋ `WEEKLY_EMAIL_ENABLED` 未設定で
                    二重に停止中。`ow_notifications_type_check` は
                    like / comment / scout / message の4値で**求人の種別が無い**）。
                 ⚠️ 書いてよいのは実測で確かめた2つだけ:
                      ・保存（`ow_bookmarks` / `/mypage/bookmarks` が実在）
                      ・在籍者の経歴（ログイン済みの一般アカウントで `/u/[id]` を開いて確認）
                 ⚠️★**「比べられます」と書かないこと。** 比較画面は無い（保存した企業の
                    カード一覧だけ）。しかも `/companies` の分割ビューは**未ログインでも使える**
                    ので、比べることは登録の理由になっていない。 */
              { q: "登録しないと使えませんか？", a: "企業情報・求人・記事は、すべて登録なしで読めます。登録すると増えるのは2つです。ひとつは、在籍している方・していた方が登録した職歴を読めること。もうひとつは、気になる企業や募集を保存しておけることです。", open: true },
              // スカウト機能は実装済み（ow_scouts / can_send_scout）。
              // ⚠️★2026-08-27 に**既定でオン**をやめた（フェーズ3）。送信可否は
              //    `ow_profiles.career_stance`（本人が選ぶ・既定値なし）が決める。
              //    **「初期設定は『受け取る』」と書かないこと。** 未設定のあいだは届かない。
              // ⚠️★**登録画面の告知は 2026-09-09 に外した**（長すぎるという柴さんの判断）。
              //    同じ内容を言う場所は**ここと規約と `/onboarding/stance`**:
              //    ① ここ
              //    ② **登録直後の `/onboarding/stance`**（選ぶ前に「この答えで何が決まるか」を出す）
              //    ③ 利用規約 第8条（content/legal/terms-of-service-jobseeker.md）
              //    ⚠️ ③は改定日が要る。**規約の改定と同時に出すこと。**
              //    ⚠️ `src/app/(auth)/auth/page.tsx` の登録ボタン下は**もう無い**。探さないこと
              //       （経緯はあちらのコメントに残してある）。
              // ★★「現在準備中」を足した（2026-09-01）。
              //    ⚠️ 上の説明は**受け取りの条件**としては正確だが、
              //       **スカウトがまだ1通も送れないこと**に触れていなかった。
              //       実測（2026-09-01）: `SCOUT_SENDING_ENABLED` **未設定**
              //       （`POST /api/biz/scouts` は認証より前に 503）／ `ow_scouts` **0件**。
              //       受け取る設定にしている人が17人いても**届きようがない。**
              //    ⚠️ 2026-08-31 に `/biz/scouts`、2026-09-01 に `/mypage/scouts` を
              //       同じ理由で直した。**ここが3つ目。**
              //    ⚠️★**求職者に「準備中」と伝えているのは、いまここ1箇所だけ。**
              //       登録画面にもあったが 2026-09-09 に外した（`/onboarding/stance` は
              //       受け取りの条件は言うが、準備中には触れていない）。
              // ★★2026-09-10: **手で消す形をやめ、フラグに連動させた。**
              //    ⚠️ 「開けたら消す」は**消し忘れと消しすぎの両方**が起きる。
              //       開けた日に自動で消え、戻した日に自動で戻る。
              //    ⚠️ 判定は `isScoutSendingEnabled()` の1本。**ここで env を読まない。**
              //    ⚠️ このページは ISR（`revalidate = 300`）なので、**最大5分は古い文言が出る。**
              /* ★2026-09-17 に2箇所直した。
      ① 「マイページの**意思表示**」→「**転職・面談の状況**」。
         カードの見出しは 2026-09-12 に変わっており、**画面に「意思表示」はもう無い**
         （PC・375px の両方で実画面を確認）。
         ⚠️★利用規約の改定後条文（2026-09-27 効力発生）にも同じ古い名前が残っている。
            **規約は別セッションと共有中なので、このセッションでは触っていない。**
      ② 「いま在籍している会社の採用担当には、そもそも表示されません」を足した。
         `can_send_scout()` の条件2・2b（自由入力の社名も `normalize_company_name` で一致）。
         **いちばん気にされる点なのに書かれていなかった。**
   ⚠️★**「始まりましたらお知らせします」は外した。**
      **知らせる手段が実装されていない**（2026-09-17 実測）:
        ・お知らせ／ニュースのテーブルが無い
        ・`ow_notifications` の種別は like / comment / scout / message の4つだけ
        ・`/admin` に一斉配信の画面が無い（`invite` は招待メール）
        ・週次メールは `vercel.json` の crons が空で二重に停止中（そもそも用途が違う）
        ・`dm/bulk-message` は**既存の会話にしか送れない**
      ⚠️ 作ったら書き戻してよい。**作る前に書かないこと。** */
              { q: "登録すると、スカウトが届きますか？", a: `登録しただけでは届きません。登録のあとに「転職について」を1問おたずねします。そこで「今は考えていない」を選ぶと、企業の候補者検索にあなたは表示されません。答えるまでのあいだも届きません。答えはマイページの「転職・面談の状況」からいつでも変えられます。いま在籍している会社の採用担当には、そもそも表示されません。営業電話はありません。${scoutSendingEnabled ? "" : "なお、企業からのスカウト送信は現在準備中です。"}` },
              /* ⚠️ 実測（2026-09-16）: 掲載22社とも `industry_id` が IT・ソフトウェア。
                    クローラ・スクレイパは存在しない（`open-graph-scraper` は
                    利用者が貼った URL の OGP 取得用で、企業データには使っていない）。 */
              { q: "掲載企業はどうやって選んでいますか？", a: "IT業界に絞ったうえで、OPINIO が選定した企業を掲載しています。web上の情報を自動で集めたものではありません。" },
              /* ★★2026-09-16 追加。「経歴を載せる側」の不安に答える2問。
                 ⚠️★どちらも在籍者向けセクションと**同じ裏取り**に基づく。
                    片方だけ直すと食い違うので、**文言を変えるときは両方見ること。** */
              { q: "ここに載っている経歴は、どうやって集めていますか？", a: "ご本人が登録したものだけです。OPINIOが代わりに作成したり、他のサービスから取り込んだりはしていません。公開する範囲（公開 / ログインユーザーのみ / 非公開）も、ご本人が選べます。" },
              /* ⚠️★「知られません」と言い切らないこと。**塞いでいるのは候補者検索だけ。**
                    企業ページの現役社員には、本人が選んだ公開範囲に従って出る。 */
              { q: "いまの会社に、登録していることが知られませんか？", a: "在籍中として登録した会社からは、あなたを候補者として検索できないようにしています。会社名を自由入力で書いた場合も同じです。ただし、その会社のページには在籍者として表示されます（初期設定では、OPINIOにログインしている方にだけ表示されます）。表示したくない場合は、公開範囲を「非公開」にできます。" },
              { q: "本当に無料で使えますか？", a: "はい。求職者側の費用は一切かかりません。" },
            ].map((item, i) => (
              <details key={i} open={item.open} style={{ borderBottom: `1px solid ${C.line}`, padding: "18px 0" }}>
                <summary style={{ cursor: "pointer", fontSize: 15.5, fontWeight: 700, color: C.navy, display: "flex", gap: 12, alignItems: "flex-start", listStyle: "none", userSelect: "none" }}>
                  <span style={{ flex: 1 }}>{item.q}</span>
                  <span className="lp-faq-arrow" style={{ fontSize: 18, color: C.muted, flexShrink: 0 }}>›</span>
                </summary>
                <p style={{ fontSize: 14, color: "#3E4A5C", marginTop: 11, lineHeight: 1.8 }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 最終CTA ══════════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.navy, color: "#fff", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 28px" }}>
          <h2 style={{ fontSize: "clamp(22px,2.6vw,32px)", fontWeight: 800, color: "#fff", marginBottom: 14, letterSpacing: "-0.01em" }}>
            まず、調べるところから。
          </h2>
          {/* 本文とボタンはログイン状態で出し分ける。
              登録済みの人に「無料登録」を出さないため（FinalCta.tsx 参照）。 */}
          <FinalCta navy={C.navy} />
        </div>
      </section>

      {/* 人物帯は Career Agent へ移設のため非表示（SHOW_PEOPLE_BAND を true で復帰） */}
      {SHOW_PEOPLE_BAND && null}
    </div>
  );
}
