// src/components/legal/LegalDocument.tsx
// 規約・ポリシー共通レンダリングコンポーネント
// Tailwind prose クラスで見出し・段落・リスト・テーブルを自動スタイリング

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface LegalDocumentProps {
  content: string;
}

export function LegalDocument({ content }: LegalDocumentProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
      <article className="prose prose-slate max-w-none prose-headings:scroll-mt-20">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content}
        </ReactMarkdown>
      </article>
    </main>
  );
}
