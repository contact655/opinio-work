// src/components/mentors/ConsultationSection.tsx
// 悩みカテゴリセクション（ヘッダー + メンターカルーセル）
// GenreSection と同構造

import { MentorCarousel } from "./MentorCarousel";
import type { CategoryWithMentors } from "@/lib/mentors";

type Props = {
  category: CategoryWithMentors;
};

export function ConsultationSection({ category }: Props) {
  // 該当メンターが 0 名なら非表示
  if (category.mentors.length === 0) return null;

  return (
    <section style={{ marginBottom: 56 }}>
      {/* セクションヘッダー */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 20,
      }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#1a1d24" }}>
            {category.name}
          </span>
          {category.description && (
            <span style={{ fontSize: 13, color: "#8b95a3", fontWeight: 400, marginLeft: 12 }}>
              {category.description}
            </span>
          )}
        </div>
      </div>

      {/* カルーセル */}
      <MentorCarousel mentors={category.mentors} />
    </section>
  );
}
