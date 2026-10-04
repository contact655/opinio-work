import type React from "react";
import Image from "next/image";
import Link from "next/link";
import type { ZukanArticle } from "@/lib/zukan/articles";
import { formatZukanDate } from "@/lib/zukan/articles";
import { ZUKAN_AUTHORS } from "@/lib/zukan/authors";
import {
  ZUKAN_AGENT_LICENSE,
  ZUKAN_AGENT_NOTE,
  ZUKAN_CTA_HEADING_LINES,
  ZUKAN_LINE_URL,
} from "@/lib/constants/zukan";

/**
 * 社長図鑑の部品。⚠️ hooks を使わない（サーバーコンポーネントから使う）。
 * ⚠️ `<style>` の中に `>` と `"` を書かない（ui-conventions）。
 * ⚠️ 色は既存のトークンだけ。新しい色を持ち込まない。
 */

// ─── 写真 ────────────────────────────────────────────────────────────────────

/** 社長の写真。無ければ名前の1文字目（推測の画像で埋めない） */
export function ZukanPhoto({
  article,
  size,
  priority = false,
}: {
  article: Pick<ZukanArticle, "heroImage" | "ceoName">;
  /** 一辺の px。null なら親の幅いっぱい（正方形） */
  size: number | null;
  priority?: boolean;
}) {
  const box = size == null
    ? { width: "100%", aspectRatio: "1 / 1" as const }
    : { width: size, height: size };
  return (
    <div
      style={{
        ...box,
        position: "relative", flexShrink: 0, overflow: "hidden",
        borderRadius: 14, background: "var(--royal-50)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {article.heroImage ? (
        <Image
          src={article.heroImage}
          alt={`${article.ceoName}さんの写真`}
          fill
          priority={priority}
          sizes={size == null ? "(max-width: 767px) 100vw, 360px" : `${size}px`}
          style={{ objectFit: "cover", objectPosition: "center 25%" }}
        />
      ) : (
        <span aria-hidden style={{ fontSize: size == null ? 64 : Math.round(size * 0.4), fontWeight: 700, color: "var(--royal)" }}>
          {article.ceoName.slice(0, 1)}
        </span>
      )}
    </div>
  );
}

// ─── 図鑑カード（記事詳細の冒頭）───────────────────────────────────────────────

/**
 * ⚠️★値が無い項目は**行ごと出さない**。「-」や「非公開」で埋めないこと。
 * ⚠️ 会社名は `companyHref` があるとき（＝ OPINIO の企業ページが公開中）だけリンクにする。
 *    無いときは文字だけで出す（404 への行き止まりを作らない。CLAUDE.md）。
 */
export function ZukanCeoCard({ article, companyHref }: { article: ZukanArticle; companyHref: string | null }) {
  const rows: { label: string; value: React.ReactNode }[] = [];
  rows.push({
    label: "会社",
    value: companyHref ? (
      <Link href={companyHref} style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>
        {article.companyName}
      </Link>
    ) : article.companyName,
  });
  if (article.business) rows.push({ label: "事業", value: article.business });
  if (article.foundedYear != null) rows.push({ label: "創業", value: `${article.foundedYear}年` });
  if (article.employees) rows.push({ label: "社員数", value: article.employees });

  return (
    <section aria-label="図鑑カード" className="zukan-card">
      <div className="zukan-card-photo">
        <ZukanPhoto article={article} size={null} priority />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", color: "var(--ink-mute)", margin: "0 0 6px" }}>
          社長図鑑
        </p>
        <p style={{ fontFamily: "var(--font-noto-serif)", fontSize: 24, fontWeight: 700, color: "var(--ink)", lineHeight: 1.4, margin: "0 0 4px" }}>
          {article.ceoName}
        </p>
        {article.oneLiner && (
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--royal)", lineHeight: 1.6, margin: "0 0 16px" }}>
            {article.oneLiner}
          </p>
        )}
        <dl style={{ margin: 0, borderTop: "1px solid var(--line-soft)" }}>
          {rows.map((r) => (
            <div key={r.label} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--line-soft)", fontSize: 14, lineHeight: 1.6 }}>
              <dt style={{ width: 56, flexShrink: 0, color: "var(--ink-mute)", fontWeight: 600 }}>{r.label}</dt>
              <dd style={{ margin: 0, color: "var(--ink)", minWidth: 0, overflowWrap: "anywhere" }}>{r.value}</dd>
            </div>
          ))}
        </dl>
        {companyHref && (
          <Link href={companyHref} style={{ display: "inline-block", marginTop: 14, fontSize: 13, fontWeight: 600, color: "var(--royal)", textDecoration: "none" }}>
            OPINIO で企業情報を見る →
          </Link>
        )}
      </div>
      <style>{`
        .zukan-card {
          display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px; align-items: start;
          background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px;
          margin-bottom: 40px;
          box-shadow: 0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07);
        }
        @media (max-width: 639px) {
          .zukan-card { grid-template-columns: minmax(0, 1fr); gap: 18px; padding: 18px; }
          .zukan-card-photo { max-width: 160px; }
        }
      `}</style>
    </section>
  );
}

// ─── 一覧カード ──────────────────────────────────────────────────────────────

export function ZukanListCard({ article }: { article: ZukanArticle }) {
  return (
    <Link href={`/zukan/${article.slug}`} className="zukan-list-card">
      <ZukanPhoto article={article} size={null} />
      <div style={{ padding: "14px 4px 4px" }}>
        <p style={{ fontFamily: "var(--font-noto-serif)", fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1.45, margin: 0 }}>
          {article.ceoName}
        </p>
        <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "2px 0 8px", lineHeight: 1.5 }}>
          {article.companyName}
        </p>
        {article.oneLiner && (
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--royal)", lineHeight: 1.6, margin: "0 0 8px" }}>
            {article.oneLiner}
          </p>
        )}
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
          <time dateTime={article.publishedAt}>{formatZukanDate(article.publishedAt)}</time>
        </p>
      </div>
    </Link>
  );
}

// ─── この記事を書いた人 ───────────────────────────────────────────────────────

/** ⚠️ 肩書き・紹介文が空なら出さない（推測で埋めない。lib/zukan/authors.ts） */
export function ZukanAuthorBox({ article }: { article: ZukanArticle }) {
  const a = ZUKAN_AUTHORS[article.author];
  return (
    <section aria-labelledby="zukan-author-heading" style={{ marginTop: 56, padding: "20px 22px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--bg-tint)" }}>
      <h2 id="zukan-author-heading" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--ink-mute)", margin: "0 0 10px" }}>
        この記事を書いた人
      </h2>
      <p style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{a.name}</p>
      {a.title && <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "2px 0 0" }}>{a.title}</p>}
      {a.bio && <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8, margin: "10px 0 0" }}>{a.bio}</p>}
    </section>
  );
}

// ─── 相談への導線（末尾に1か所だけ）─────────────────────────────────────────────

/**
 * ⚠️★**本文の途中に置かないこと。** 記事の末尾に1か所だけ（2026-10-04 / 柴さんの指示）。
 * ⚠️★`ZUKAN_AGENT_NOTE` と許可番号を**外さないこと。** 導線の先は Opinio Agent（人材紹介）で、
 *    OPINIO 本体（募集情報等提供）とは別サービス。それを示すための一文。
 * ⚠️ 別ページへの遷移なので濃紺の塗り（ui-conventions「色の役割」）。
 */
export function ZukanConsultCta() {
  return (
    <section aria-labelledby="zukan-cta-heading" style={{ marginTop: 32, padding: "28px 22px", border: "1px solid var(--line)", borderRadius: 14, background: "#fff", textAlign: "center" }}>
      <h2 id="zukan-cta-heading" style={{ fontFamily: "var(--font-noto-serif)", fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1.6, margin: "0 0 16px" }}>
        {/* 各行を inline-block にして、折り返すなら行の境目で折れるようにする */}
        {ZUKAN_CTA_HEADING_LINES.map((line) => (
          <span key={line} style={{ display: "inline-block" }}>{line}</span>
        ))}
      </h2>
      <a
        href={ZUKAN_LINE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block", padding: "12px 28px", borderRadius: 10,
          background: "var(--royal)", color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
        }}
      >
        LINE で相談する
      </a>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: "16px 0 0" }}>{ZUKAN_AGENT_NOTE}</p>
      <p style={{ fontSize: 11, color: "var(--ink-mute)", margin: "4px 0 0" }}>{ZUKAN_AGENT_LICENSE}</p>
    </section>
  );
}

// ─── 企業ページの「社長図鑑に掲載されています」───────────────────────────────────

/**
 * 企業詳細の `<main>` の中、「企業概要」の直後に置く。
 * ⚠️★サイドバー（`hidden lg:flex`）に移さないこと。1023px 以下で消える。
 * ⚠️ 該当記事が無い企業では呼び出し側で何も描かない。
 */
export function ZukanCompanyCard({ articles }: { articles: ZukanArticle[] }) {
  return (
    <section
      aria-label="社長図鑑"
      style={{
        background: "#fff", border: "1px solid var(--line)", borderRadius: 18,
        marginBottom: "var(--space-6)", padding: "18px 22px",
        boxShadow: "0 1px 3px rgba(15,23,42,0.07), 0 4px 16px rgba(15,23,42,0.07)",
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-mute)", margin: "0 0 12px" }}>
        社長図鑑に掲載されています
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {articles.map((a) => (
          <Link key={a.slug} href={`/zukan/${a.slug}`} style={{ display: "flex", gap: 14, alignItems: "center", textDecoration: "none" }}>
            <ZukanPhoto article={a} size={64} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>
                {a.ceoName}
              </p>
              {a.oneLiner && (
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--royal)", margin: "1px 0 0", lineHeight: 1.5 }}>{a.oneLiner}</p>
              )}
              {/* ⚠️ 記事タイトルは2行で切る（2026-10-04 / 柴さんの指示）。375px だと4行に折れて
                     カードが縦に伸びていた。全文は title 属性で読める。
                  ⚠️ 親の `minWidth: 0` を外さないこと。外すとクランプが効かずに押し広げる。 */}
              <p
                title={a.title}
                style={{
                  fontSize: 13, color: "var(--ink-soft)", margin: "2px 0 0", lineHeight: 1.6, overflowWrap: "anywhere",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}
              >
                {a.title}
              </p>
            </div>
            <span aria-hidden style={{ color: "var(--royal)", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>読む →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
