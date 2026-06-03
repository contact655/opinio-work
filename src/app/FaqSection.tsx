"use client";

import { useState } from "react";

const faqs = [
  // 1. 競合比較
  { q: "WantedlyやGreenと何が違いますか？", a: "OPINIOは「IT/SaaS業界に絞った厳選企業のみ」を掲載しています。Wantedly・Greenが数万件の求人を扱うのに対し、OPINIOは編集部が取材・審査した企業のみを公開しています。スカウトは一切なく、求職者が能動的に情報を集めて判断できる設計です。" },
  // 2. カジュアル面談
  { q: "カジュアル面談とは何ですか？面接ですか？", a: "選考とは別の、30分程度の情報交換の場です。気になる企業の現役社員に、仕事内容・カルチャー・働き方を直接聞けます。合否判定のない対話なので、「まだ転職するか決めていない」段階でも気軽に申し込めます。" },
  // 3. コスト
  { q: "本当に無料ですか？", a: "はい、求職者の方は完全無料です。企業閲覧・求人確認・カジュアル面談の申込、すべて費用はかかりません。" },
  // 4. ハードル
  { q: "転職するか決めていなくても使えますか？", a: "もちろんです。「転職すべきか迷っている」「今の市場価値を知りたい」という段階でも、企業情報の閲覧やカジュアル面談の申込ができます。「転職しない」という結論でもOKです。" },
  // 5. 誰向け
  { q: "IT未経験でも使えますか？", a: "はい。「IT業界に転職したいが何から始めればいいかわからない」という方でも利用できます。取材記事で業界理解を深めながら、気になる企業にカジュアル面談を申し込むことができます。" },
  // 6. スカウトなし
  { q: "スカウトが届かない設計とはどういう意味ですか？", a: "OPINIOでは企業から求職者へのスカウトメールは送れない仕組みになっています。「登録したら大量のスカウトが来た」という経験をなくすための設計です。求職者が自分のペースで企業を調べて、動きたいときに動けるプラットフォームを目指しています。" },
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
            <div key={i} className="border-b border-gray-100 py-5">
              <button
                type="button"
                className="w-full text-left cursor-pointer"
                aria-expanded={open === i}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[15px] font-medium text-[#0f172a]">{faq.q}</span>
                  <span className="text-[#1D9E75] text-xl flex-shrink-0 transition-transform" style={{ transform: open === i ? "rotate(45deg)" : "none" }} aria-hidden="true">+</span>
                </div>
              </button>
              {open === i && (
                <p
                  id={`faq-answer-${i}`}
                  role="region"
                  aria-labelledby={`faq-question-${i}`}
                  className="text-[14px] text-[#475569] leading-relaxed mt-3"
                >
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
