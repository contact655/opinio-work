// src/components/companies/GenreSection.tsx
// ジャンルセクション（ヘッダー + カルーセル）
// モック companies-carousel-mock.html のセクションヘッダーに合わせて更新

import Link from "next/link";
import { GenreCarousel } from "./GenreCarousel";
import type { GenreWithCompanies } from "@/types/genre";

type Props = {
  genre: GenreWithCompanies;
};

export function GenreSection({ genre }: Props) {
  return (
    <section id={`genre-${genre.slug}`} style={{ marginBottom: 56 }}>
      {/* セクションヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Left accent bar */}
          <div style={{
            width: 4, height: 22, borderRadius: 2, flexShrink: 0,
            background: 'linear-gradient(180deg, var(--royal) 0%, var(--accent) 100%)',
          }} />
          <div>
            <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)' }}>
              {genre.name}
            </span>
            {(genre.description || genre.total_count > 0) && (
              <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 400, marginLeft: 10 }}>
                {genre.description && genre.description}
                {genre.description && genre.total_count > 0 && ' ・ '}
                {genre.total_count > 0 && `${genre.total_count}社`}
              </span>
            )}
          </div>
        </div>
        {genre.total_count > 0 && (
          <Link
            href={`/companies?genre=${genre.slug}`}
            style={{
              fontSize: 13,
              color: 'var(--accent)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            すべて見る →
          </Link>
        )}
      </div>

      {/* カルーセル */}
      <GenreCarousel companies={genre.companies} />
    </section>
  );
}
