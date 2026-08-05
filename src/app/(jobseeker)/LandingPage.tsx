import Link from "next/link";
import Image from "next/image";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { HeroSearch } from "./HeroSearch";
import { FinalCta } from "./FinalCta";
import { ProductShot } from "./ProductShot";

/**
 * DATA セクション「経歴が構造化されている」に添える実画面。
 *
 * ⚠️ null にすると画面なしの3列グリッドに戻る（掲載を止めたくなったときはここを null に）。
 *
 * ── 出典（2026-08-05）───────────────────────────────────────────────────────
 * /u/b51fc35e（木村雅樹さん）の職歴タイムライン。ご本人から、実績値を含め、
 * 検索エンジンに載ることも含めて掲載許可を得ている。
 * ⚠️ /u/[id] は middleware でログイン必須（visibility=login_only）。つまりこの画像は
 *    ログインしないと見られない情報を公開ページに出している。撮り直し・差し替えのときも
 *    本人の許可を取り直すこと。他の人に差し替える場合も同じ。
 * ⚠️ 生藤弘樹さんは運営が作ったプレースホルダーなので、許可があっても使わない。
 *    「実データが構造化されている」証拠にならないため。
 *
 * ── 切り出し ────────────────────────────────────────────────────────────────
 * wide: viewport 1440px（デスクトップの実レイアウト）で 700×715px。表示584pxに対し 0.83倍。
 *   現行の ProductPreview（0.81）より緩く、14pxの本文が読める。
 *   下端は必ず行の境目に合わせる。実測位置は 職歴見出し top=856 / カード左端 x=210 で
 *     470=AEの期間の直後（実績値が入らない） / 525=AEの説明文の直後 /
 *     715=セールスフォースの続きを読むの直後 / 866=みずほ証券の期間の直後
 *   715 は、会社の移動（CTC←セールスフォース）と同社内の職種変化
 *   （インサイドセールス→AE）が両方映り、本文2文の両方を裏付けるため選んだ。
 *
 * narrow: viewport 440px（1カラム表示）で 372×543px。実測 職歴見出し top=1019 / x=20 / 幅400。
 *   ⚠️ wide をそのまま狭い画面に出すと破綻する。375px幅では表示291pxまで縮んで
 *      0.42倍になり、14pxの本文が6pxになる。2026-08-04 に preview-search で踏んだのと同じ。
 *      切り替えは 620px 未満（下の .lp-career-* を参照）。
 *
 * ⚠️ 差し替えるときは必ずファイル名の連番を上げること（-v1 → -v2）。
 *    Next の画像最適化は元パスをキーにするので、同名だと古いバイト列が配信され続ける。
 *    2026-08-04 に実際に起きた。
 */
const CAREER_SHOT: {
  wide: { src: string; w: number; h: number };
  narrow: { src: string; w: number; h: number };
  alt: string;
} | null = {
  wide:   { src: "/images/lp/preview-career-v1.webp",    w: 1168, h: 1193 },
  narrow: { src: "/images/lp/preview-career-sm-v1.webp", w: 1088, h: 1588 },
  alt: "OPINIO のプロフィール画面の職歴。年ごとに会社名・部署・役職・職種・在籍期間が構造化されて並び、同じ会社の中での職種の変化も辿れる。",
};

const CAREER_CARD = {
  title: "経歴が構造化されている",
  body: "どこから来て、どこへ行ったか。社員のキャリアがデータとして残っているので、企業単位でも職種単位でも辿れます。",
};

// ─── Types ───────────────────────────────────────────────────────────────────
export type LPTotals = { companies: number; jobs: number };
export type LPFacet = { key: string; label: string; count: number; href: string };

export type LPCompanyCard = {
  id: string;
  name: string;
  industry: string | null;
  phase: string | null;
  logoUrl: string | null;
  logoLetter: string | null;
  logoGradient: string | null;
  companyUrl: string | null;
  articleCount: number;
  jobCount: number;
  memberCount: number;
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
  if (min && max) return `${min.toLocaleString("ja-JP")}〜${max.toLocaleString("ja-JP")}万円`;
  if (min) return `${min.toLocaleString("ja-JP")}万円〜`;
  if (max) return `〜${max.toLocaleString("ja-JP")}万円`;
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

        .lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
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
          .lp-cards, .lp-jobs, .lp-steps, .lp-trust { grid-template-columns: 1fr; }
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
            FV は 見出し・検索窓の2要素のみ。サブコピー / 注記 / 件数バッジ / アイブロウは置かない。
            「何のサービスか」は検索窓のプレースホルダーが担う
            （IT・SaaS という業界の限定はそこにしか書いていないので、短くしないこと）。

            ⚠️ 2026-08-04: 英語見出し「The full picture, before you apply.」から戻した。
               ① apply（応募）が転職を前提にしており、「転職を前提にしない」という
                  プロダクトの方針と矛盾していた。見出しで応募を前提に置くと、
                  情報収集の段階にいる人を最初の一画面で締め出すことになる
               ② 無名ブランドの英語見出しは日本市場で意味伝達が弱い。
                  英語見出しが機能するのは、読み手が既にブランドを知っていて
                  「雰囲気」として受け取れる場合に限られる
               英語に戻すなら上の2点をどう解くかを先に決めること。

            和文なので letter-spacing を軽く詰める（英語では詰めていなかった）。
            文字数が減った分 fontSize を上げている。実機で 375/768/1440px を確認済み。
          */}
          <h1 style={{ fontSize: "clamp(34px, 4.6vw, 62px)", fontWeight: 800, lineHeight: 1.3, letterSpacing: "-0.02em", color: C.navy, marginBottom: 34 }}>
            確かめてから、動く。
          </h1>

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
              <Link key={c.id} href={`/companies/${c.id}`} className="lp-card">
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
                      {[c.industry, phaseText(c.phase)].filter(Boolean).join(" ／ ") || "—"}
                    </small>
                  </div>
                </div>
                {/*
                  ⚠️ 0 の項目は出さない（2026-08-05 変更）。「—」も出さない。
                     以前は「件数が増えたときに伸びが見える」ことを理由に 0 を出していたが、
                     実データでは12社中 社員0が11社・求人0が5社・記事0が4社で、
                     最も目立つ場所に 0 が並ぶ状態になっていた。
                     値が無いものを出さない、という既存方針に揃える。
                  ⚠️ 3項目とも 0 なら行ごと出さない。現データでは該当0社だが、
                     在庫が増えると発生しうるので分岐は残す。
                  ラベルは 600 / 数字は 700 + navy。
                */}
                {(() => {
                  const facts = [
                    { label: "記事", n: c.articleCount },
                    { label: "求人", n: c.jobCount },
                    { label: "社員", n: c.memberCount },
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

      {/* ══ 使い方 ═══════════════════════════════════════════════════════════ */}
      <section className="lp-section" style={{ background: C.paper2 }}>
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div>
              <div className="lp-eyebrow">HOW IT WORKS</div>
              <h2 className="lp-h2">探して、比べて、決める</h2>
            </div>
          </div>
          {/*
            01 / 02 は実画面つきなので2列。03 は画像が無いのでその下に1枚で置く。
            ⚠️ 3列にしないこと。表示幅が約294pxになり、画像の13pxの文字が6pxになって読めない。
               画像は「表示幅 × 1.3」を上限に切り出してある（.pp-grid の518px前提）。
               2026-08-04 に DATA カードで同じ失敗をして画像を一度外している。
            ⚠️ ここに置いた画像は、以前 FV 直下にあった独立セクション（ProductPreview）のもの。
               下の HOW IT WORKS と同じ説明を2回していたので統合した。意匠は .pp-* をそのまま使う。
          */}
          <div className="pp-grid" style={{ marginBottom: 18 }}>
            {[
              {
                n: "01", title: "探す", body: "業種・フェーズ・勤務形態で絞り込む。登録は要りません。", href: "/companies",
                wide:   { src: "/images/lp/preview-search-v2.webp",    w: 1280, h: 800 },
                narrow: { src: "/images/lp/preview-search-sm-v2.webp", w: 900,  h: 376 },
                alt: "OPINIO の募集検索結果。職種・年収・勤務形態で絞り込め、各募集に年収レンジが表示されている。",
              },
              {
                n: "02", title: "比べる", body: "記事・求人・働く人の経歴を、企業ページで横に並べて見る。", href: "/companies",
                wide:   { src: "/images/lp/preview-company-v2.webp",    w: 1320, h: 620 },
                narrow: { src: "/images/lp/preview-company-sm-v2.webp", w: 900,  h: 311 },
                alt: "OPINIO の企業ページ。主な製品・サービスと、導入事例の活用内容・成果が並んでいる。",
              },
            ].map((s) => (
              <div key={s.n}>
                <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 6 }}>{s.n}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 6 }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: "0 0 14px" }}>{s.body}</p>
                <ProductShot wide={s.wide} narrow={s.narrow} alt={s.alt} href={s.href} line={C.line} />
              </div>
            ))}
          </div>

          {/* 03 は対応する画面が無いので画像なし。3枚揃える必要はない
              （「決める」は画面上の操作ではなく本人の判断なので、そもそも絵にならない） */}
          <Link href="/jobs" style={{ display: "block", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 24, textDecoration: "none" }}>
            <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 8 }}>03</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 8 }}>決める</h3>
            {/* 転職を前提にしない。「今は動かない」も結論として扱う */}
            <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0 }}>応募する、時期を待つ、今の会社に残る。急かす連絡は届きません。</p>
          </Link>

          <p style={{ marginTop: 18, fontSize: 12, color: C.muted, textAlign: "center" }}>
            画面は実際のものです。掲載内容は変わることがあります。
          </p>
        </div>
      </section>

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
              // ⚠️ 2026-08-04 に ow_profiles.scout_enabled の既定を true にした。
              //    「初期設定はオフ」と書かないこと。登録画面でも同じ内容を告知している
              //    （src/app/(auth)/auth/page.tsx の登録ボタン下）。片方だけ直すと食い違う。
              //    2026-08-04 以前に登録した人は null（未選択）のままで、届かない状態が続く。
              { q: "登録すると、スカウトが届きますか？", a: "初期設定は「受け取る」です。プロフィール編集の「公開設定」からいつでもオフにできます。オフにすると、企業の候補者検索にあなたは表示されなくなります。営業電話はありません。" },
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
