import Link from "next/link";
import { CompanyLogo } from "@/components/common/CompanyLogo";
import { HeroSearch } from "./HeroSearch";
import { FinalCta } from "./FinalCta";
import { ProductPreview } from "./ProductPreview";
import Image from "next/image";

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
        /* .lp-trust-shot と .pp-* は globals.css 側にある。
           空文字を指定する content の引用符が、Server Component の style タグでは
           実体参照にエスケープされ、raw text 要素なのでブラウザが復元しないため。
           この style タグの中には引用符・大なり・小なりを書かないこと。 */

        @media (max-width: 900px) {
          .lp-section { padding: 52px 0; }
          .lp-wrap { padding: 0 18px; }
          .lp-facets { grid-template-columns: repeat(2, 1fr); }
          .lp-cards, .lp-jobs, .lp-steps, .lp-trust { grid-template-columns: 1fr; }
          /* プレビューは1カラムだと縦に伸びすぎるので6件までに絞る。
             総件数は「N社すべて見る」で示しているので数は隠していない。 */
          /* 子結合子（大なり記号）は使わないこと。Server Component 内の style タグでは
             React がサーバー出力で実体参照にエスケープするが、style は raw text 要素のため
             ブラウザが復元せず、SSR 時点でセレクタが壊れる（hydration mismatch も出る）。
             同じ理由で、この中に大なり・小なり・引用符を書かないこと。
             nth-child は元々親基準なので、子クラス指定で足りる。 */
          .lp-cards .lp-card:nth-child(n+7), .lp-jobs .lp-card:nth-child(n+7) { display: none; }
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
            見出しが英語のため「何のサービスか」は検索窓のプレースホルダーが担う
            （IT・SaaS という業界の限定はそこにしか書いていないので、短くしないこと）。
            英語見出しは letter-spacing を詰めない — 和文と違って詰めると読みにくくなる。
          */}
          <h1 style={{ fontSize: "clamp(30px, 3.6vw, 50px)", fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.015em", color: C.navy, marginBottom: 34 }}>
            The full picture,<br />before you apply.
          </h1>

          <HeroSearch navy={C.navy} line={C.line} muted={C.muted} />
        </div>
      </section>

      {/* ══ プロダクト画面プレビュー（FV の主張の裏付け）════════════════════ */}
      <ProductPreview line={C.line} navy={C.navy} muted={C.muted} blue={C.blue} />

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
              {
                title: "企業情報を独自に作成している",
                body: "掲載企業の情報は web から自動で集めたものではなく、OPINIO が作成・編集しています。事業内容・組織体制・働き方まで揃えています。",
                // 主張の裏付けとして実画面を添える。テキストで言うより証明力が高い。
                // 残り2枚（所属の認証 / 経歴の構造化）は実在の個人が写るため、
                // LP 掲載の可否を本人に確認してから追加する。
                shot: { src: "/images/lp/preview-company.webp", alt: "企業ページに並ぶ、製品・サービス10製品と導入事例8社の活用内容・成果。", w: 2240, h: 1182 },
              },
              { title: "所属が認証されている", body: "社員として掲載されている人は、本人が名乗っているのではなく企業側が在籍を確認しています。匿名の口コミサイトとは情報の出どころが違います。", shot: null },
              { title: "経歴が構造化されている", body: "どこから来て、どこへ行ったか。社員のキャリアがデータとして残っているので、企業単位でも職種単位でも辿れます。", shot: null },
            ].map((t) => (
              <div key={t.title} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 24, display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 9 }}>{t.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0 }}>{t.body}</p>
                {t.shot && (
                  <span className="lp-trust-shot" style={{ borderColor: C.line }}>
                    <Image src={t.shot.src} alt={t.shot.alt} width={t.shot.w} height={t.shot.h}
                      sizes="(max-width: 900px) 100vw, 340px"
                      style={{ width: "100%", height: "auto", display: "block" }} />
                  </span>
                )}
              </div>
            ))}
          </div>
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
                {/* 0 でも欄を出す。件数が増えたときに伸びが見えるようにするため */}
                {/* ラベルは 600 / 数字は 700 + navy。ウェイトを上げても「数字が主役」の階層は色で保つ */}
                <div style={{ display: "flex", gap: 14, paddingTop: 13, borderTop: `1px solid ${C.paper2}`, fontSize: 12.5, fontWeight: 600, color: C.muted }}>
                  {[
                    { label: "記事", n: c.articleCount },
                    { label: "求人", n: c.jobCount },
                    { label: "社員", n: c.memberCount },
                  ].map((m) => (
                    <span key={m.label}>
                      {m.label}{" "}
                      <strong style={{ fontFamily: 'var(--font-inter), sans-serif', fontWeight: 700, color: m.n > 0 ? C.navy : C.muted }}>{m.n}</strong>
                    </span>
                  ))}
                </div>
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
          <div className="lp-steps">
            {[
              { n: "01", title: "探す", body: "業種・フェーズ・勤務形態で絞り込む。登録は要りません。", href: "/companies" },
              { n: "02", title: "比べる", body: "記事・求人・働く人の経歴を、企業ページで横に並べて見る。", href: "/companies" },
              // 転職を前提にしない。「今は動かない」も結論として扱う
              { n: "03", title: "決める", body: "応募する、時期を待つ、今の会社に残る。急かす連絡は届きません。", href: "/jobs" },
            ].map((s) => (
              <Link key={s.n} href={s.href} style={{ display: "block", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 24, textDecoration: "none" }}>
                <div style={{ fontFamily: 'var(--font-inter), sans-serif', fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 8 }}>{s.n}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: C.navy, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.75, margin: 0 }}>{s.body}</p>
              </Link>
            ))}
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
              { q: "登録しないと使えませんか？", a: "いいえ。企業情報・求人・記事はすべて登録なしで読めます。登録は、気になる企業を保存したり、新しい求人が出たときに通知を受け取るためのものです。", open: true },
              // スカウト機能は実装済み（ow_scouts / can_send_scout）。ただし scout_enabled は
              // デフォルト値が無く、本人が明示的にONにした場合のみ届く。事実に合わせて書く。
              { q: "登録すると、スカウトが届きますか？", a: "スカウトは、あなたが受け取ると設定した場合にだけ届きます。初期設定はオフです。設定は登録後にいつでも変更できます。営業電話はありません。" },
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
