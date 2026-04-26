"use client";

import { useState } from "react";

const faqs = [
  // 1. 競合比較
  { q: "WantedlyやGreenと何が違いますか？", a: "Opinioは「IT/SaaS業界に絞った厳選25社のみ」を掲載しています。Wantedly・Greenが数万件の求人を扱うのに対し、Opinioは編集部が3軸（プロダクト成長性・カルチャー・待遇）で評価し、審査を通過した企業のみ公開しています。さらに、求人ごとに「なぜこの求人があなたに合うか」を言語化した『Opinioの見解』をお届けします。" },
  // 2. 信頼性
  { q: "メンターはどんな人ですか？営業されませんか？", a: "メンターは全員、SaaS業界の現役・元在籍者です（Salesforce / HubSpot / Datadog / Sansan / SmartHR 等）。Opinioは応募ノルマや成功報酬で動いていないため、メンターから求人応募を勧める営業トークは一切ありません。電話もしません。" },
  // 3. コスト
  { q: "本当に無料ですか？", a: "はい、求職者の方は完全無料です。メンター相談・求人閲覧・登録、すべて費用はかかりません。" },
  // 4. ハードル
  { q: "転職するか決めていなくても使えますか？", a: "もちろんです。「転職すべきか相談したい」「今の市場価値を知りたい」という段階でもメンターに相談できます。「転職しない」という結論でもOKです。" },
  // 5. 誰向け
  { q: "IT未経験でも使えますか？", a: "はい。「IT業界に転職したいが何から始めればいいかわからない」という方の相談も歓迎しています。前職の経験をどう活かせるか、メンターと一緒に整理していきます。" },
  // 6. プロセス
  { q: "メンターとの相談と求人応募は別々にできますか？", a: "はい、完全に独立しています。メンターに相談するだけ・求人を眺めるだけ、どちらでもOKです。応募の判断はあなた自身が行います。" },
];

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section style={{ background: "#ffffff", paddingTop: 72, paddingBottom: 72 }}>
      <div className="max-w-4xl mx-auto px-8">
        <p className="text-xs font-medium text-[#1D9E75] tracking-wide mb-2">FAQ</p>
        <h2 className="text-[28px] font-medium text-[#0f172a] mb-8">あなたの不安に、第三者の目でお答えします</h2>
        <div className="max-w-2xl">
          {faqs.map((faq, i) => (
            <div key={i} className="border-b border-gray-100 py-5 cursor-pointer" onClick={() => setOpen(open === i ? null : i)}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[15px] font-medium text-[#0f172a]">{faq.q}</span>
                <span className="text-[#1D9E75] text-xl flex-shrink-0 transition-transform" style={{ transform: open === i ? "rotate(45deg)" : "none" }}>+</span>
              </div>
              {open === i && (
                <p className="text-[14px] text-[#475569] leading-relaxed mt-3">{faq.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
