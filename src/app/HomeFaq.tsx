"use client";

import { useState } from "react";

const FAQ_ITEMS = [
  {
    q: "転職せずに現職に残ってもいいですか？",
    a: "もちろんです。OPINIOは転職を前提にしたサービスではありません。「まずは市場価値を知りたい」「他社の情報を集めたい」「今の会社に残るかどうか整理したい」──そんな情報収集の段階で使っていただく方も多くいます。先輩との対話を経て「今の会社にもう少し残ろう」という結論に至ることも、立派な答えです。応募を強制することは一切ありません。",
  },
  {
    q: "他の転職サービスとの違いは何ですか？",
    a: "大きく2つあります。①IT/SaaS業界に特化した求人を掲載し、OPINIO編集部が直接取材した企業情報も合わせて公開していること。②スカウト・営業電話・メール通知なしで、自分のペースで情報収集できること。求人票だけでは分からない企業の実態を、取材記事と合わせて確認できる場所です。",
  },
  {
    q: "無料で使うことはできますか？",
    a: "はい、求職者の方は完全無料です。求人の閲覧、企業情報・取材記事の確認、応募まで、すべて料金はかかりません。メールアドレスのみで登録でき、営業電話も一切ありません。安心して、ご自分のペースでお使いください。",
  },
];

export default function HomeFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section style={{ background: "var(--bg-tint)", padding: "96px 48px" }} className="px-5 py-16 md:py-24 md:px-12">
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* ⑦ Improved heading with icon + subtitle */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: "50%",
            background: "var(--royal)", marginBottom: 16,
            boxShadow: "0 4px 16px rgba(0,35,102,0.20)",
          }}>
            <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 22, color: "#fff", lineHeight: 1 }}>?</span>
          </div>
          <h2 style={{ fontSize: "clamp(26px,3vw,36px)", fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
            よくあるご質問
          </h2>
          <p style={{ fontSize: 15, color: "var(--ink-soft)", lineHeight: 1.8, margin: 0 }}>
            OPINIOを初めて使う方からよくいただく質問に、正直にお答えします。
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                style={{ borderTop: i === 0 ? "1px solid var(--line)" : undefined, borderBottom: "1px solid var(--line)" }}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  style={{
                    width: "100%", textAlign: "left", padding: "22px 0",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "none", border: "none", cursor: "pointer",
                    gap: 16,
                  }}
                >
                  {/* ⑦ Q. decoration */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
                    <span style={{
                      fontFamily: "Inter, sans-serif", fontSize: 13, fontWeight: 800,
                      color: "var(--royal)", flexShrink: 0, marginTop: 2,
                      width: 22, textAlign: "center",
                    }}>
                      Q.
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", lineHeight: 1.5 }}>{item.q}</span>
                  </div>
                  {/* ⑦ Larger +/- in circle */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: isOpen ? "var(--royal)" : "var(--royal-50)",
                    border: "1.5px solid var(--royal-100)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s",
                  }}>
                    <span style={{
                      fontSize: 20, fontWeight: 300,
                      color: isOpen ? "#fff" : "var(--royal)",
                      lineHeight: 1,
                      transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                      transition: "transform 0.2s, color 0.2s",
                      display: "block",
                    }}>
                      +
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div style={{
                    paddingBottom: 22, paddingLeft: 34,
                    fontSize: 15, lineHeight: 1.9,
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
