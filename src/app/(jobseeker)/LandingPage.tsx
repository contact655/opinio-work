import Link from "next/link";
import Image from "next/image";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { HeroSearch } from "./HeroSearch";
import { FinalCta } from "./FinalCta";
import { fmtMan } from "@/lib/utils/salary";

/**
 * DATA セクション「経歴が構造化されている」に添える実画面。
 *
 * ⚠️ 2026-08-05 に外した（null）。LP に個人が特定できる情報を載せない方針のため。
 *
 * ── なぜマスク版に差し替えなかったか ───────────────────────────────────────
 * ow_experiences には visibility_company_profile（real / masked / hidden）があり、
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
 * ⚠️ null のあいだ、DATA セクションは①②③の3列グリッドに戻る。
 *    値を入れると上段2列＋経歴カード全幅（テキスト左・画像右）に切り替わる。
 */
const CAREER_SHOT: {
  wide: { src: string; w: number; h: number };
  narrow: { src: string; w: number; h: number };
  alt: string;
} | null = null;

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

const CAREER_CARD = {
  title: "経歴が構造化されている",
  body: "どこから来て、どこへ行ったか。社員のキャリアがデータとして残っているので、企業単位でも職種単位でも辿れます。",
};

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

/** ow_companies.phase は英語スラッグと日本語が混在しているので表示時に日本語へ寄せる */
const PHASE_LABEL: Record<string, string> = {
  listed: "上場",
  non_listed: "非上場",
  unicorn: "ユニコーン",
  seed: "シード",
  series_a: "シリーズA", series_b: "シリーズB", series_c: "シリーズC",
  series_d: "シリーズD", series_e: "シリーズE",
};
function phaseText(phase: string | null): string | null {
  if (!phase) return null;
  return PHASE_LABEL[phase] ?? phase;
}

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
}: {
  totals: LPTotals;
  industryFacets: LPFacet[];
  /** 出身校。出身業界は前職のマスタ紐付けが必要で現状ほぼ取れないため未実装 */
  schoolFacets: LPFacet[];
  companies: LPCompanyCard[];
  jobs: LPJobCard[];
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
        .lp-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .14em; color: ${C.blue}; margin-bottom: 10px; }
        .lp-sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 26px; }

        .lp-facets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .lp-facet { display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
                    background: #fff; border: 1px solid ${C.line}; border-radius: 10px;
                    padding: 12px 14px; text-decoration: none; }
        .lp-facet:hover { border-color: ${C.blue}; }

        .lp-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .lp-card { background: #fff; border: 1px solid ${C.line}; border-radius: 12px; padding: 20px; text-decoration: none; display: block; }
        .lp-card:hover { border-color: ${C.blue}; box-shadow: 0 6px 20px rgba(14,33,72,.07); }

        .lp-jobs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }

        /* FV のサブコピー。検索窓（1000px）より内側に収める。
           ⚠️ fontSize と margin はここで持つこと。インラインに書くと下の
              メディアクエリが効かなくなる（CLAUDE.md「インラインstyle と CSS の優先順位」）。
           span を inline-block にしているのは、折り返しを句の境目に固定するため。 */
        .lp-hero-sub { font-size: 15.5px; line-height: 1.7; color: ${C.muted};
                       margin: 0 0 26px; max-width: 900px; }
        .lp-hero-sub span { display: inline-block; }

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
          .lp-cards, .lp-jobs, .lp-trust { grid-template-columns: 1fr; }
          /* 狭い画面では経歴カードも縦積みにする（画像はテキストの下）。
             620px までは wide の切り出しのまま。ここでは表示幅が 600px 前後あり、
             縮小率 0.85 で本文が読める。 */
          .lp-trust-2 { grid-template-columns: 1fr; }
          .lp-trust-wide { grid-template-columns: 1fr; gap: 20px; }
          /* プレビューは1カラムだと縦に伸びすぎるので6件までに絞る。
             総件数は「N社すべて見る」で示しているので数は隠していない。 */
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

            ⚠️「IT・SaaS」という対象業界は、いまサブコピーと検索窓のプレースホルダーの
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
          <h1 style={{ fontSize: "clamp(34px, 3.2vw, 44px)", fontWeight: 800, lineHeight: 1.3, letterSpacing: "-0.02em", color: C.navy, marginBottom: 14 }}>
            確かめてから、動く。
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
          <p className="lp-hero-sub">
            <span>IT・SaaS業界の企業・求人・</span>
            <span>そこで働く人の経歴まで。</span>
          </p>

          <HeroSearch navy={C.navy} line={C.line} muted={C.muted} />
        </div>
      </section>

      {/* ══ ファセット ═══════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">BROWSE</div>
              <h2 className="lp-h2">業種から探す</h2>
            </div>
            <Link href="/companies" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap" }}>
              すべての条件で絞り込む →
            </Link>
          </div>

          <div className="lp-facets">
            {industryFacets.map((f) => (
              <Link key={f.key} href={f.href} className="lp-facet">
                <span style={{ fontSize: 13.5, fontWeight: 500, color: C.ink }}>{f.label}</span>
                <strong style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 14, fontWeight: 700, color: f.count > 0 ? C.navy : C.muted }}>
                  {f.count}
                </strong>
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
            <Link href="/companies" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap" }}>
              {totals.companies.toLocaleString("ja-JP")}社すべて見る →
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
                      {[c.businessDomain, phaseText(c.phase)].filter(Boolean).join(" ／ ") || "—"}
                    </small>
                  </div>
                </div>
                {/*
                  ⚠️ 0 の項目は出さない（2026-08-05 変更）。「—」も出さない。
                     以前は「件数が増えたときに伸びが見える」ことを理由に 0 を出していたが、
                     実データでは12社中 求人0が5社・記事0が4社で、
                     最も目立つ場所に 0 が並ぶ状態になっていた。
                     値が無いものを出さない、という既存方針に揃える。
                  ⚠️ 2項目とも 0 なら行ごと出さない。現データでは該当0社だが、
                     在庫が増えると発生しうるので分岐は残す。
                  ⚠️ 「社員」は 2026-08-05 に外した。理由は pickCompanies.ts のコメント参照。
                  ラベルは 600 / 数字は 700 + navy。
                */}
                {(() => {
                  const facts = [
                    { label: "記事", n: c.articleCount },
                    { label: "求人", n: c.jobCount },
                  ].filter((m) => m.n > 0);
                  if (facts.length === 0) return null;
                  return (
                    <div style={{ display: "flex", gap: 14, paddingTop: 13, borderTop: `1px solid ${C.paper2}`, fontSize: 12.5, fontWeight: 600, color: C.muted }}>
                      {facts.map((m) => (
                        <span key={m.label}>
                          {m.label}{" "}
                          <strong style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 700, color: C.navy }}>{m.n}</strong>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 求人インデックス ══════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">JOBS</div>
              <h2 className="lp-h2">募集中の求人</h2>
            </div>
            <Link href="/jobs" style={{ fontSize: 13.5, color: C.navy, textDecoration: "underline", textUnderlineOffset: 4, whiteSpace: "nowrap" }}>
              {totals.jobs.toLocaleString("ja-JP")}件すべて見る →
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
          <div className={CAREER_SHOT ? "lp-trust lp-trust-2" : "lp-trust"}>
            {[
              // ⚠️ 「企業情報を独自に作成している」に実画面を添えていたが 2026-08-04 に外した。
              //    カード幅342px・画像292pxでは、文字が読める切り出し幅の上限が380pxしかなく、
              //    導入事例1件の左半分（読める数字は1つ）しか入らないため。
              //    2026-08-05 に再検証しても同じで、既存の preview-company-v2.webp は
              //    518px表示用の切り出しなので295pxでは成果の数字が潰れる。
              //    ここに画像を戻すなら、もっと寄った別の切り出しが要る。
              {
                title: "企業情報を独自に作成している",
                body: "掲載企業の情報は web から自動で集めたものではなく、OPINIO が作成・編集しています。事業内容・組織体制・働き方まで揃えています。",
              },
              // ⚠️ 2026-08-04 まで「所属が認証されている / 本人が名乗っているのではなく
              //    企業側が在籍を確認しています」と書いていたが、事実と正反対だったため差し替えた。
              //    実測: 公開中の所属4件はすべて invited_at / invited_by が空で、
              //    企業側の招待フローを通っていない（運営が直接作った行）。
              //    ドメイン認証済みの企業も 85社中0社。所属は自己申告である。
              //    企業側の確認フローが実際に回り始めるまで、認証を主張しないこと。
              { title: "募集を出していない企業も載っている", body: "求人の有無にかかわらず企業ページを作っています。いま募集がない会社も、事業や組織を先に調べておけます。" },
              // CAREER_SHOT が無いあいだは、経歴カードもここに並べて3列に戻す
              ...(CAREER_SHOT ? [] : [CAREER_CARD]),
            ].map((t) => (
              <div key={t.title} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 9 }}>{t.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0 }}>{t.body}</p>
              </div>
            ))}
          </div>

          {/* 経歴カードは画面つきのときだけ全幅の行に分ける（理由は .lp-trust-wide のコメント） */}
          {CAREER_SHOT && (
            <div className="lp-trust-wide">
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 9 }}>{CAREER_CARD.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0 }}>{CAREER_CARD.body}</p>
                <p style={{ fontSize: 12, color: C.muted, marginTop: 12, marginBottom: 0 }}>
                  画面は実際のものです。掲載内容は変わることがあります。
                </p>
              </div>
              {/* 画面幅で画像そのものを差し替える。CSS の縮小では読めるようにならない
                  （理由は CAREER_SHOT のコメントと .lp-career-* を参照） */}
              <span className="lp-career-wide">
                <Image src={CAREER_SHOT.wide.src} alt={CAREER_SHOT.alt}
                  width={CAREER_SHOT.wide.w} height={CAREER_SHOT.wide.h} sizes="584px" />
              </span>
              <span className="lp-career-narrow">
                <Image src={CAREER_SHOT.narrow.src} alt={CAREER_SHOT.alt}
                  width={CAREER_SHOT.narrow.w} height={CAREER_SHOT.narrow.h} sizes="100vw" />
              </span>
            </div>
          )}
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
              { q: "登録しないと使えませんか？", a: "いいえ。企業情報・求人・記事はすべて登録なしで読めます。登録は、気になる企業を保存したり、新しい求人が出たときに通知を受け取るためのものです。", open: true },
              // スカウト機能は実装済み（ow_scouts / can_send_scout）。
              // ⚠️★2026-08-27 に**既定でオン**をやめた（フェーズ3）。送信可否は
              //    `ow_profiles.career_stance`（本人が選ぶ・既定値なし）が決める。
              //    **「初期設定は『受け取る』」と書かないこと。** 未設定のあいだは届かない。
              // ⚠️ 同じ内容を**3箇所**で言っている。片方だけ直すと食い違う:
              //    ① ここ ② 登録画面（src/app/(auth)/auth/page.tsx の登録ボタン下）
              //    ③ 利用規約 第8条（content/legal/terms-of-service-jobseeker.md）
              //    ⚠️ ③は改定日が要る。**規約の改定と同時に出すこと。**
              // ★★「現在準備中」を足した（2026-09-01）。
              //    ⚠️ 上の説明は**受け取りの条件**としては正確だが、
              //       **スカウトがまだ1通も送れないこと**に触れていなかった。
              //       実測（2026-09-01）: `SCOUT_SENDING_ENABLED` **未設定**
              //       （`POST /api/biz/scouts` は認証より前に 503）／ `ow_scouts` **0件**。
              //       受け取る設定にしている人が17人いても**届きようがない。**
              //    ⚠️ 2026-08-31 に `/biz/scouts`、2026-09-01 に `/mypage/scouts` を
              //       同じ理由で直した。**ここが3つ目。**
              //    ⚠️ **再開するときはこの一文を消すこと。**（`SCOUT_SENDING_ENABLED=true` と同時）
              { q: "登録すると、スカウトが届きますか？", a: "登録しただけでは届きません。登録のあとに「転職について」を1問おたずねします。そこで「今はいない」を選ぶと、企業の候補者検索にあなたは表示されません。答えるまでのあいだも届きません。答えはマイページの「意思表示」からいつでも変えられます。営業電話はありません。なお、企業からのスカウト送信は現在準備中です。始まりましたらお知らせします。" },
              { q: "掲載企業はどうやって選んでいますか？", a: "IT・SaaS業界に絞ったうえで、OPINIO が選定した企業を掲載しています。web上の情報を自動で集めたものではありません。" },
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
