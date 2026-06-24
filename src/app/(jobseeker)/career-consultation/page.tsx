import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "キャリア相談 — OPINIO",
  description: "IT/SaaS業界に特化した専任アドバイザーが、あなたのキャリア相談に無料で対応します。",
};

// ── 相談員データ（将来的にDBから取得） ─────────────────────────────────────────
const CONSULTANTS = [
  {
    id: "shibasan",
    slug: "shibasan",
    name: "柴 久人",
    photoUrl: null as string | null,
    avatarColor: "linear-gradient(135deg, #002366 0%, #3B5FD9 100%)",
    initial: "柴",
    tags: ["#IT/SaaS転職", "#外資系", "#キャリア設計", "#スタートアップ"],
    bio: "IT/SaaS業界に特化したキャリアプラットフォームOPINIOの代表。外資系SaaS・国内SaaS・スタートアップへの転職を専門とし、業界の最新動向と実際の社員・OBGのリアルな声をもとに、一人ひとりに合ったキャリア設計をサポートします。",
    available: true,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConsultantCard({ c }: { c: typeof CONSULTANTS[number] }) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: "28px 28px 24px",
      maxWidth: 760,
      margin: "0 auto 20px",
    }}>
      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {c.tags.map(tag => (
          <span key={tag} style={{
            fontSize: 12, fontWeight: 600, color: "var(--royal)",
            background: "var(--royal-50)",
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* Profile row */}
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 20 }}>
        {/* Avatar */}
        <div style={{ flexShrink: 0 }}>
          {c.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.photoUrl}
              alt={c.name}
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--line)" }}
            />
          ) : (
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: c.avatarColor,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 24, fontWeight: 700,
              border: "2px solid var(--line)",
            }}>
              {c.initial}
            </div>
          )}
        </div>

        {/* Name + Bio */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-noto-serif)", marginBottom: 10 }}>
            {c.name}
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>
            {c.bio}
          </p>
        </div>
      </div>

      {/* CTA */}
      <a
        href="https://app.spirinc.com/t/dYaaXibfGNDVGWc-qqv3v/as/MplNXcvVmuxIH2dTMecpF/confirm"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block", textAlign: "center",
          padding: "14px 24px", borderRadius: 10,
          border: "1.5px solid var(--royal)",
          color: "var(--royal)", background: "#fff",
          fontSize: 15, fontWeight: 700,
          textDecoration: "none",
          transition: "background 0.15s",
        }}
      >
        日程を選ぶ →
      </a>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CareerConsultationPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fff" }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(155deg, #edf0fa 0%, #ece8ff 28%, #f6f0ff 55%, #fafafa 78%, #fff 100%)",
        padding: "56px 24px 48px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <h1 style={{
            fontSize: "clamp(26px, 3.5vw, 38px)",
            fontWeight: 800,
            color: "var(--ink)",
            fontFamily: "var(--font-noto-serif)",
            marginBottom: 16,
            lineHeight: 1.3,
          }}>
            キャリア相談
          </h1>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.8, marginBottom: 8 }}>
            全ての面談を専任のキャリアアドバイザーが担当します。<br />
            ご自身のご希望に沿った面談をお気軽にご選択ください。
          </p>

          {/* Why points */}
          <div style={{
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "24px 28px",
            textAlign: "left",
            marginTop: 28,
            marginBottom: 28,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 14 }}>
              OPINIOが選ばれる理由
            </div>
            {[
              { n: "01", text: "IT/SaaS業界の最新求人情報をもとにした的確なアドバイス" },
              { n: "02", text: "現役社員・OB/OGのリアルな声を踏まえた企業紹介" },
              { n: "03", text: "強引なプッシュなし。あなたのペースで進められる相談" },
            ].map(p => (
              <div key={p.n} style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 10, fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                <span style={{ color: "var(--royal)", fontWeight: 700, fontFamily: "Inter", flexShrink: 0 }}>{p.n}.</span>
                <span>{p.text}</span>
              </div>
            ))}
          </div>

          <a
            href="https://app.spirinc.com/t/dYaaXibfGNDVGWc-qqv3v/as/MplNXcvVmuxIH2dTMecpF/confirm"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "14px 40px",
              borderRadius: 100,
              background: "var(--royal)",
              color: "#fff",
              fontSize: 15, fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 4px 16px rgba(0,35,102,0.2)",
            }}
          >
            面談を申し込む →
          </a>
        </div>
      </section>

      {/* ── Consultants ──────────────────────────────────────────────────── */}
      <section style={{ padding: "48px 24px 64px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2 style={{
            fontSize: 20, fontWeight: 700, color: "var(--ink)",
            marginBottom: 24,
          }}>
            アドバイザーから選ぶ
          </h2>
          {CONSULTANTS.map(c => (
            <ConsultantCard key={c.id} c={c} />
          ))}
        </div>
      </section>

    </div>
  );
}
