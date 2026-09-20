import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { HeroSearch } from "./HeroSearch";
import { FinalCta } from "./FinalCta";
import { AuthAwareCta } from "./AuthAwareCta";
import { fmtMan } from "@/lib/utils/salary";
import { phaseLabel } from "@/lib/constants/phase";
import { LP_JOBS_MIN_TO_SHOW, LP_ARTICLES_COPY } from "@/lib/constants/landing";
/* ⚠️★カテゴリのラベルと色は `TYPE_BADGE` の1箇所から引く。**ここに書き写さないこと**
      —— `/articles` の一覧・記事詳細も同じ定数を見ており、割れると同じ記事が
      画面によって違うカテゴリ名で出る。 */
import { TYPE_BADGE, type ArticleType } from "@/app/articles/mockArticleData";

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

/**
 * ★記事カード（2026-09-20 / 柴さんの指示で新設）。
 *
 * ⚠️★**公開日と読了時間を入れないこと。** 型に無いので表示側で出すこともできない。
 *    日付 … 最新が 2026-03-01 で、出すと**更新が止まって見える**
 *    読了時間 … 測っていない記事がある（`ow_articles.read_min` は `number | null`）
 *    ⚠️ `/articles` のカードは**どちらも出している**。**揃っていないのは意図的。**
 */
export type LPArticleCard = {
  slug: string;
  /** カテゴリ。ラベルと色は `TYPE_BADGE`（`mockArticleData.ts`）の1箇所から引く */
  type: ArticleType;
  title: string;
  companyName: string;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  companyUrl: string | null;
  /** 話し手の職種（例: シニアPdM）。⚠️ 無ければ null。「—」で埋めない */
  speakerRole: string | null;
};

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
  articles,
  totals,
  industryFacets,
  schoolFacets,
  companies,
  jobs,
}: {
  /** 新着順4本。⚠️ 取得は `page.tsx`（`/articles` と同じ `getArticles()`） */
  articles: LPArticleCard[];
  totals: LPTotals;
  industryFacets: LPFacet[];
  /** 出身校。出身業界は前職のマスタ紐付けが必要で現状ほぼ取れないため未実装 */
  schoolFacets: LPFacet[];
  companies: LPCompanyCard[];
  jobs: LPJobCard[];
  /**
   * ★スカウト送信が開いているか。**2026-09-20 から LP では使っていない。**
   *
   * ⚠️★唯一の読み手だった FAQ「登録すると、スカウトが届きますか？」を同日に削除した
   *    （柴さんの指示）。その中の「なお、企業からのスカウト送信は現在準備中です。」が
   *    この値に連動していた。
   * ⚠️★**これで「準備中」の告知は求職者側から消えた**（実測 2026-09-20: 残る「準備中」は
   *    `/biz` 側と無関係な画面だけ）。CLAUDE.md の
   *    「『準備中』の文言は手で消さない。開けた日に自動で消える」は**LP には効かなくなった。**
   * ⚠️ 受け取り方の告知は `/onboarding` の意思表示の画面が担っている（`/auth` 側の注記を参照）。
   *    **ただし「準備中」だけはあちらに無い。**
   *
   * ⚠️ props は残してある。FAQ を書き戻すときに配線し直さずに済むように。
   */
  scoutSendingEnabled?: boolean;
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

        /* ★記事の4枚（2026-09-20）。
           ⚠️★**.lp-cards（3列）を流用しないこと。** 4本だと 3+1 で割れる。
              カードの見た目（.lp-card）は企業セクションと同じものを使い、**列数だけ別**。
           ⚠️ 下のメディアクエリで 900px 以下は1列にしてある。
           ⚠️ この style タグの中にバッククォート・引用符・大なり小なりを書かないこと。 */
        .lp-articles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        /* セクションのリード文。⚠️ 見出しの直下・カードの上に置く */
        .lp-lead { font-size: 14.5px; line-height: 1.85; color: ${C.muted}; margin: -14px 0 24px; }

        /* ⚠️★ .lp-trust 系と .lp-member-points は **2026-09-20 に使い手が0**になった
              （DATA と FOR MEMBERS のセクションを削除したため）。
              **消さずに残してある** —— 戻すときの手がかりになるので。
              ⚠️ 下のメディアクエリにも同じクラス名が残っている。片方だけ消さないこと。 */
        .lp-member-points { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }

        /* FV のサブコピー。検索窓（1000px）より内側に収める。
           ⚠️ fontSize と margin はここで持つこと。インラインに書くと下の
              メディアクエリが効かなくなる（CLAUDE.md「インラインstyle と CSS の優先順位」）。
           span を inline-block にしているのは、折り返しを句の境目に固定するため。 */
        /* ⚠️ .lp-hero-sub は 2026-09-20 にサブコピーごと削除したので**使い手が0**。
              書き戻すときのために残してある（span の inline-block は折り返しを
              句の境目に固定するためのもので、消すと 375px で「見られ／ます。」と割れる）。
              ⚠️ ここは style のテンプレートリテラルの中。コメントにバッククォートを書かない。 */
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

        /* ⚠️ 4列は 1100px 未満だと1枚 240px を切って見出しが3行で溢れる。
              中間の幅では2列（2x2）にする —— 指示にある「または 2x2」がこれ。 */
        @media (max-width: 1100px) {
          .lp-articles { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 900px) {
          .lp-section { padding: 52px 0; }
          .lp-wrap { padding: 0 18px; }
          .lp-facets { grid-template-columns: repeat(2, 1fr); }
          .lp-cards, .lp-jobs, .lp-trust, .lp-member-points, .lp-articles { grid-template-columns: 1fr; }
          .lp-lead { margin: -8px 0 20px; }
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
          {/* ★2026-09-20 に「会社を、そこで働く人から知る。」から差し替えた（柴さんの指示）。
                 ⚠️★**4箇所すべて同時に変えること。** ここ／`page.tsx` の title と
                    openGraph.title ／ `/business` の「求職者は、OPINIOで…」。
                    `/business` 側には「トップの h1 と完全一致させる」と注記がある。

                 ⚠️ 実測（2026-09-20 / 本番）で裏は取ってある。**量は約束していない**
                    （体言止めなので「何人いる」と言っていない）:
                      公開求人 2件・出しているのは1社（セールスフォース）
                      → その1社の現役社員 **1人**（OB を含めて3人）
                      掲載22社の現役社員は **3人 / 3社**
                 ⚠️★**未ログインには1人も見えない**（実ユーザー10人が全員 `login_only`）。
                    押した人は必ずログイン画面に着く。**「N人の現役社員」の形にしないこと。**

                 ⚠️ span は inline-block（`.lp-hero-h1 span`）。**折り返しを句の境目に固定するため。**
                    狭い幅では1行に収まらないので「求人票の向こうにいる／現役社員」で折る。
                    ⚠️ 塊にしないと「現役社／員」のように語の途中で割れる。 */}
          <h1 className="lp-hero-h1" style={{ fontSize: "clamp(30px, 3.0vw, 42px)", fontWeight: 800, lineHeight: 1.35, letterSpacing: "-0.02em", color: C.navy, marginBottom: 14 }}>
            <span>求人票の向こうにいる</span>
            <span>現役社員</span>
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
          {/* ⚠️★見出しの下のサブコピー（「IT企業の事業と、…経歴は登録すると読めます。」）は
                 **2026-09-20 に柴さんの指示で削除した。** 戻さないこと。
              ⚠️ 消えたのは「何をまとめているか」と「登録すると読める」の2点で、
                 **FV から「なぜ登録するのか」の説明が無くなっている。**
                 登録の理由を書き戻したくなったら、まずここを読むこと ——
                 以前の2文は実測で裏を取ってあった（掲載22社のうち組織体制1社・
                 働き方1社だったので「事業」までに留め、未ログインでは経歴が
                 1行も見えないので「登録すると」を落とさない、という作り）。
                 **同じ強さの文を書くなら、同じように実測してから。** */}

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
            <Link href="/companies" className="lp-hero-btn lp-hero-btn-solid">企業を見る</Link>
            {/* ⚠️★登録済みの人に「無料登録」を出さない（`FinalCta` と同じ理由）。
                   `member` を `null` にしてあるので、**ログイン済みではボタンごと消える**
                   ——FV に2つ並べる意味は「まだ登録していない人に登録の理由を見せる」ことなので、
                   済んでいる人には左の「企業を見る」だけで足りる。 */}
            <AuthAwareCta
              className="lp-hero-btn lp-hero-btn-ghost"
              /* ⚠️★**2026-09-20 に「無料登録して経歴を見る」→「無料登録」へ短くした**
                    （柴さんの指示）。**最終CTA（`FinalCta`）・`/feed` の登録パネルと
                    同時に変えてあり、3箇所とも同じ文言。片方だけ変えないこと。** */
              guest={{ href: "/auth", label: "無料登録" }}
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

      {/* ══ 記事 ═════════════════════════════════════════════════════════════
          ★2026-09-20 に新設（柴さんの指示）。**ここには DATA と FOR MEMBERS があった。**

          ── 消した2つ（戻すなら理由ごと読むこと）─────────────────────────
          ① DATA「このデータは、どこから来ているか」（3カード）
             ⚠️ 中身の1つ「事業内容・組織体制・働き方まで揃えています」は**ほぼ事実でなかった**
                （掲載22社のうち 組織体制1社 / 働き方1社 / 福利厚生1社。
                 docs/phase0-top-page-20260916.md ★4）。
          ② FOR MEMBERS「転職を考えていなくても、あなたの経歴は誰かの判断材料になります」
             （2カード＋「経歴を載せる」ボタン）
             ⚠️★**訴求は FAQ が引き受けている**（「いまの会社に、登録していることが
                知られませんか？」ほか2項目）。**FAQ を消すとこの訴求がサイトから消える。**

          ── なぜ募集セクションではなく記事か ───────────────────────────────
          ⚠️ 公開求人は**2件・1社**（株式会社セールスフォース・ジャパン）。
             セクションに立てると在庫の薄さが最も目立つ場所に出る。
             **求人が20〜30件を超えたら再検討する**（柴さんの指示）。
             既存の `LP_JOBS_MIN_TO_SHOW`（10件）とは別の基準なので、
             **戻すときはしきい値も一緒に見直すこと。** */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">{LP_ARTICLES_COPY.eyebrow}</div>
              <h2 className="lp-h2">{LP_ARTICLES_COPY.heading}</h2>
            </div>
            <Link href="/articles" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap" }}>
              記事をもっと読む →
            </Link>
          </div>
          <p className="lp-lead">{LP_ARTICLES_COPY.lead}</p>

          {/* ⚠️★カードの見た目は企業セクションと同じ `.lp-card`。**列数だけ `.lp-articles`**
                 （`.lp-cards` は3列なので、4本だと 3+1 で割れる）。 */}
          <div className="lp-articles">
            {articles.map((a) => {
              const badge = TYPE_BADGE[a.type];
              return (
                <Link key={a.slug} href={`/articles/${a.slug}`} className="lp-card">
                  {/* カテゴリ。⚠️ ラベルも色も `TYPE_BADGE` から。直書きしない */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", padding: "3px 9px",
                    borderRadius: 100, background: badge.bg, color: badge.color,
                    fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", marginBottom: 12,
                  }}>
                    {badge.label}
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                    <CompanyLogo
                      name={a.companyName}
                      logoUrl={a.logoUrl}
                      logoLetter={a.logoLetter}
                      logoGradient={a.logoGradient}
                      companyUrl={a.companyUrl}
                      size="sm"
                    />
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.companyName}
                    </span>
                  </div>

                  <h3 style={{
                    fontFamily: "var(--font-noto-serif)",
                    fontSize: 15, fontWeight: 700, lineHeight: 1.55, color: C.navy,
                    margin: 0,
                    display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  } as React.CSSProperties}>
                    {a.title}
                  </h3>

                  {/* 話し手の職種。⚠️ 無ければ行ごと出さない（「—」で埋めない） */}
                  {a.speakerRole && (
                    <small style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 600, color: C.muted }}>
                      {a.speakerRole}
                    </small>
                  )}

                  {/* ⚠️★**公開日と読了時間は出さない**（型にも入れていない）。
                         日付は最新が 2026-03-01 で、出すと更新が止まって見えるため。
                         読了時間は測っていない記事があるため。 */}
                </Link>
              );
            })}
          </div>

          {/* ★募集への導線（2026-09-20）。⚠️★**外さないこと。**
                 実測（2026-09-20 / 未ログイン）で、**本文から `/jobs` へ行く導線は0本**だった
                 —— `LandingPage` の「募集をすべて見る」は `LP_JOBS_MIN_TO_SHOW`（10件）
                 未満で**セクションごと非表示**、`FinalCta` の「新着の募集を見る」は
                 **ログイン済みにしか出ない**。
              ⚠️ 募集カードを並べるセクションは作らないこと（上の注記の理由）。 */}
          <div style={{ marginTop: 22, textAlign: "center" }}>
            <Link href="/jobs" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4 }}>
              募集を探す →
            </Link>
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
              /* ⚠️ 実測（2026-09-16）: 掲載22社とも `industry_id` が IT・ソフトウェア。
                    クローラ・スクレイパは存在しない（`open-graph-scraper` は
                    利用者が貼った URL の OGP 取得用で、企業データには使っていない）。 */
              { q: "掲載企業はどうやって選んでいますか？", a: "IT業界に絞ったうえで、OPINIO が選定した企業を掲載しています。web上の情報を自動で集めたものではありません。" },
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
