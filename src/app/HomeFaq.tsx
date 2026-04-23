"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "転職せずに現職に残ってもいいですか？",
    a: "もちろんです。Opinioは転職を前提にしたサービスではありません。「まずは市場価値を知りたい」「他社の情報を集めたい」「今の会社に残るかどうか整理したい」──そんな情報収集の段階で使っていただく方も多くいます。先輩との対話を経て「今の会社にもう少し残ろう」という結論に至ることも、立派な答えです。応募を強制することは一切ありません。",
  },
  {
    q: "他の転職サービスとの違いは何ですか？",
    a: "大きく3つあります。①IT/SaaS業界の求人を網羅的に集め、ここを見れば済む場所を目指していること。②Opinio編集部の取材と企業への定期アンケートで、求人情報を最新に保っていること。③「数年先を歩く似た経歴の先輩」に、30分からカジュアルに相談できること。求人票だけでは分からない情報と、相談相手が揃う場所であること、が違いです。",
  },
  {
    q: "相談相手はどんな人が登録されていますか？",
    a: "IT/SaaS業界で実際に働いた経験のある、数年先を歩く現役/元社員です。営業・CS・PdM・エンジニア・マーケなど職種もさまざま。あなたの経歴・志向に近い先輩を自動で提案する仕組みになっているので、「自分と似た道を通ってきた人」に話を聞けます。営業ノルマはなく、求人への応募を迫ることもありません。",
  },
  {
    q: "無料で使うことはできますか？",
    a: "はい、求職者の方は完全無料です。求人の閲覧、企業情報の確認、先輩への相談、応募まで、すべて料金はかかりません。メールアドレスのみで登録でき、営業電話も一切ありません。安心して、ご自分のペースでお使いください。",
  },
];

export default function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section style={{ background: "var(--bg-tint)", padding: "96px 48px" }} className="px-5 py-16 md:py-24 md:px-12">
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--royal)", textTransform: "uppercase", marginBottom: 16 }}>
          FAQ
        </div>
        <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 700, color: "var(--ink)", marginBottom: 48 }}>
          よくあるご質問
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                style={{ borderTop: i === 0 ? "1px solid var(--line)" : undefined, borderBottom: "1px solid var(--line)" }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  style={{
                    width: "100%", textAlign: "left", padding: "20px 0",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 16, fontWeight: 600, color: "var(--ink)",
                    gap: 16,
                  }}
                >
                  <span>{item.q}</span>
                  <span style={{
                    fontSize: 22, fontWeight: 300, color: "var(--royal)",
                    flexShrink: 0, transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                    transition: "transform 0.2s",
                    lineHeight: 1,
                  }}>
                    +
                  </span>
                </button>
                {isOpen && (
                  <div style={{
                    paddingBottom: 20, fontSize: 15, lineHeight: 1.9,
                    color: "var(--ink-soft)",
                  }}>
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
