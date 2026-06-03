import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "企業様向け掲載・料金プラン | OPINIO",
  description:
    "OPINIOへの求人掲載は完全無料。採用が決まった時点のみ、年収の10%をいただく完全成果報酬型です。IT/SaaS業界に特化した転職プラットフォームで、納得採用を実現します。",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div style={{ background: "#f0f4f8", minHeight: "100vh" }}>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        padding: "72px 24px 80px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.12)", borderRadius: 100,
            padding: "6px 16px", marginBottom: 24,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.8)", textTransform: "uppercase" as const,
          }}>
            FOR COMPANIES
          </div>
          <h1 style={{
            fontFamily: "var(--font-noto-serif)",
            fontSize: "clamp(24px, 4vw, 38px)",
            fontWeight: 700, color: "#fff",
            lineHeight: 1.35, marginBottom: 20,
          }}>
            掲載費ゼロ。<br />採用が決まったときだけ、費用が発生します。
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.72)", lineHeight: 1.8, marginBottom: 36 }}>
            IT/SaaS業界に特化したキャリアプラットフォームOPINIOは、<br />
            完全成果報酬型。採用成功まで一切の費用はかかりません。
          </p>
          <a
            href="mailto:info@opinio.jp?subject=OPINIOへの掲載について"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "14px 32px", borderRadius: 8,
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 4px 20px rgba(245,158,11,0.4)",
            }}
          >
            まず相談する（無料）
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </section>

      {/* ── 料金モデル ── */}
      <section style={{ padding: "64px 24px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", marginBottom: 12, textTransform: "uppercase" as const }}>PRICING MODEL</div>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
            シンプルな完全成果報酬
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.8 }}>
            掲載・取材・記事制作・カジュアル面談ファシリテート、すべて無料。<br />採用が決まったときのみ費用が発生します。
          </p>
        </div>

        {/* 料金カード */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginBottom: 48 }}>

          {/* 掲載費 */}
          <div style={{
            background: "#fff", borderRadius: 16, padding: "32px 28px",
            border: "1.5px solid var(--line)",
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--success)", textTransform: "uppercase" as const }}>LISTING FEE</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: "var(--ink)", fontFamily: "Inter, sans-serif", lineHeight: 1 }}>
              ¥0
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7 }}>
              求人掲載・企業ページ作成・記事取材・カジュアル面談の設定まで、すべて完全無料。
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {["求人掲載（件数無制限）", "企業ページ制作", "OPINIOオリジナル取材記事", "カジュアル面談マッチング"].map(item => (
                <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* 成果報酬 */}
          <div style={{
            background: "linear-gradient(135deg, #001233 0%, #002366 100%)",
            borderRadius: 16, padding: "32px 28px",
            border: "1.5px solid var(--royal)",
            display: "flex", flexDirection: "column", gap: 12,
            position: "relative" as const,
          }}>
            <div style={{
              position: "absolute" as const, top: -12, left: "50%", transform: "translateX(-50%)",
              background: "var(--warm)", color: "#fff",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
              padding: "4px 14px", borderRadius: 100,
            }}>
              採用成功時のみ
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.6)", textTransform: "uppercase" as const }}>SUCCESS FEE</div>
            <div style={{ lineHeight: 1 }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: "#fff", fontFamily: "Inter, sans-serif" }}>10%</span>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginLeft: 8 }}>/ 採用者の年収</span>
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", lineHeight: 1.7 }}>
              採用が確定した時点で、採用者の想定年収の10%をご請求します。採用成功前は一切費用は発生しません。
            </div>
            <div style={{
              marginTop: 8, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "16px 18px",
              border: "1px solid rgba(255,255,255,0.12)",
            }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>計算例</div>
              {[
                { salary: "400万円", fee: "40万円" },
                { salary: "600万円", fee: "60万円" },
                { salary: "800万円", fee: "80万円" },
              ].map(({ salary, fee }) => (
                <div key={salary} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>
                  <span>年収 {salary}</span>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, color: "#fff" }}>→ {fee}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 注記 */}
        <div style={{
          background: "#fff", borderRadius: 12, padding: "20px 24px",
          border: "1px solid var(--line)",
          fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.8,
        }}>
          ※ 成果報酬の対象は、OPINIOを通じたカジュアル面談・求人応募・紹介を起点とした採用に限ります。<br />
          ※ 採用確定後、企業様のビズ管理画面から「採用確定」をご報告いただいた時点で請求書を発行します。<br />
          ※ 詳細な契約条件はお問い合わせ後に個別にご案内します。
        </div>
      </section>

      {/* ── 導入の流れ ── */}
      <section style={{ background: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", marginBottom: 12, textTransform: "uppercase" as const }}>HOW IT WORKS</div>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink)" }}>
              導入から採用決定まで
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              {
                step: "01", color: "var(--royal)", bg: "var(--royal-50)",
                title: "お問い合わせ・無料掲載開始",
                desc: "メールでご連絡いただければ、3営業日以内に企業ページの作成・求人掲載を開始します。取材記事の制作もOPINIOが行います。",
              },
              {
                step: "02", color: "var(--warm)", bg: "var(--warm-soft)",
                title: "求職者との接点（カジュアル面談）",
                desc: "転職検討中のユーザーが企業ページを見て、カジュアル面談を申し込みます。OPINIOがマッチングをサポートします。",
              },
              {
                step: "03", color: "var(--purple)", bg: "var(--purple-soft)",
                title: "選考・内定",
                desc: "カジュアル面談や求人応募から選考に進みます。選考フローは企業様の通常フローと同じです。",
              },
              {
                step: "04", color: "var(--success)", bg: "var(--success-soft)",
                title: "採用確定の報告 → 請求書発行",
                desc: "採用が決まったら、ビズ管理画面から「採用確定」をご報告ください。OPINIOから請求書を発行します（年収の10%）。",
              },
            ].map(({ step, color, bg, title, desc }, i) => (
              <div key={step} style={{ display: "flex", gap: 24, paddingBottom: i < 3 ? 32 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: bg, border: `2px solid ${color}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 800, color, fontFamily: "Inter, sans-serif",
                    flexShrink: 0,
                  }}>
                    {step}
                  </div>
                  {i < 3 && <div style={{ width: 2, flex: 1, background: "var(--line)", marginTop: 8 }} />}
                </div>
                <div style={{ paddingTop: 10, paddingBottom: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.75 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 競合比較 ── */}
      <section style={{ padding: "64px 24px", maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", marginBottom: 12, textTransform: "uppercase" as const }}>COMPARISON</div>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink)" }}>
            他サービスとの比較
          </h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: "var(--ink-soft)", borderBottom: "1px solid var(--line)" }}>サービス</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, color: "var(--ink-soft)", borderBottom: "1px solid var(--line)" }}>掲載費</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, color: "var(--ink-soft)", borderBottom: "1px solid var(--line)" }}>成果報酬</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, color: "var(--ink-soft)", borderBottom: "1px solid var(--line)" }}>カジュアル面談</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontWeight: 600, color: "var(--ink-soft)", borderBottom: "1px solid var(--line)" }}>IT/SaaS特化</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "OPINIO", listing: "無料", fee: "年収10%", casual: true, it: true, highlight: true },
                { name: "Wantedly", listing: "月額〜10万円+", fee: "なし（月額のみ）", casual: true, it: false, highlight: false },
                { name: "Green", listing: "月額〜20万円+", fee: "なし", casual: false, it: true, highlight: false },
                { name: "ビズリーチ", listing: "月額〜60万円+", fee: "なし", casual: false, it: false, highlight: false },
                { name: "人材エージェント", listing: "無料", fee: "年収30〜35%", casual: false, it: false, highlight: false },
              ].map(({ name, listing, fee, casual, it, highlight }) => (
                <tr key={name} style={{
                  borderBottom: "1px solid var(--line-soft)",
                  background: highlight ? "var(--royal-50)" : undefined,
                }}>
                  <td style={{ padding: "14px 20px", fontWeight: highlight ? 700 : 500, color: highlight ? "var(--royal)" : "var(--ink)" }}>
                    {highlight && <span style={{ fontSize: 10, fontWeight: 800, background: "var(--royal)", color: "#fff", borderRadius: 4, padding: "2px 6px", marginRight: 8 }}>◀</span>}
                    {name}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: highlight ? 700 : 400, color: highlight ? "var(--success)" : "var(--ink-soft)" }}>{listing}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center", fontWeight: highlight ? 700 : 400, color: "var(--ink-soft)" }}>{fee}</td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    {casual
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <span style={{ color: "var(--ink-mute)", fontSize: 16 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    {it
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      : <span style={{ color: "var(--ink-mute)", fontSize: 16 }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 12, textAlign: "center" }}>※ 競合他社の料金は公開情報に基づく概算です</p>
      </section>

      {/* ── FAQ ── */}
      <section style={{ background: "#fff", padding: "64px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", marginBottom: 12, textTransform: "uppercase" as const }}>FAQ</div>
            <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(18px, 2.5vw, 24px)", fontWeight: 700, color: "var(--ink)" }}>
              よくあるご質問
            </h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                q: "本当に掲載費は無料ですか？",
                a: "はい、完全無料です。求人掲載、企業ページ作成、取材記事制作、カジュアル面談マッチングまで、採用が決まるまで一切費用は発生しません。",
              },
              {
                q: "「採用が決まった」はどう判断しますか？",
                a: "企業様の管理画面（ビズダッシュボード）から「採用確定」をご報告いただいたタイミングを起点とします。ご報告後、OPINIOから請求書を発行します。",
              },
              {
                q: "年収10%の計算対象はどの年収ですか？",
                a: "内定時に提示した想定年収（基本給+賞与の合計）を基準とします。詳細は個別にご相談ください。",
              },
              {
                q: "何名採用しても10%ですか？",
                a: "はい、1名ごとに採用者の年収10%となります。複数名採用の場合は都度ご相談も可能です。",
              },
              {
                q: "OPINIO経由でない応募者も対象になりますか？",
                a: "いいえ。OPINIOのプラットフォームを通じたカジュアル面談・求人応募・紹介を起点とした採用のみが対象です。",
              },
            ].map(({ q, a }) => (
              <div key={q} style={{
                border: "1px solid var(--line)",
                borderRadius: 12, overflow: "hidden",
              }}>
                <div style={{ padding: "18px 22px", background: "var(--bg-tint)" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", display: "flex", gap: 10 }}>
                    <span style={{ color: "var(--royal)", fontFamily: "Inter, sans-serif", flexShrink: 0 }}>Q.</span>
                    {q}
                  </div>
                </div>
                <div style={{ padding: "16px 22px 18px" }}>
                  <div style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.75, display: "flex", gap: 10 }}>
                    <span style={{ color: "var(--warm)", fontFamily: "Inter, sans-serif", fontWeight: 700, flexShrink: 0 }}>A.</span>
                    {a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{
        padding: "72px 24px",
        background: "linear-gradient(135deg, #001233 0%, #002366 60%, #1a3569 100%)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-noto-serif)", fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 700, color: "#fff", marginBottom: 16 }}>
            まずはお気軽にご相談ください
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", lineHeight: 1.8, marginBottom: 36 }}>
            初回相談・企業ページ作成・求人掲載まで完全無料。<br />
            採用成功まで費用は一切かかりません。
          </p>
          <a
            href="mailto:info@opinio.jp?subject=OPINIOへの掲載について&body=企業名：%0D%0Aご担当者名：%0D%0Aご連絡先：%0D%0Aご質問・ご相談内容：%0D%0A"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "16px 40px", borderRadius: 8,
              background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
              color: "#fff", fontSize: 16, fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 4px 24px rgba(245,158,11,0.5)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            info@opinio.jp にメールする
          </a>
          <div style={{ marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
            通常3営業日以内にご返信します
          </div>
        </div>
      </section>

    </div>
  );
}
