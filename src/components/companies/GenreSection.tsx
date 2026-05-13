// src/components/companies/GenreSection.tsx
// ジャンルセクション（ヘッダー + カルーセル）
// 段階：genres-feature Phase C

import Link from "next/link";
import { GenreCarousel } from "./GenreCarousel";
import type { GenreWithCompanies } from "@/types/genre";

type Props = {
  genre: GenreWithCompanies;
};

export function GenreSection({ genre }: Props) {
  return (
    <section className="mb-8">
      <div className="flex justify-between items-baseline mb-2">
        <div>
          <h2 className="text-base font-medium inline">{genre.name}</h2>
          {genre.description && (
            <span className="text-xs text-gray-500 ml-2">
              {genre.description}
              {genre.total_count > 0 && ` ・ ${genre.total_count}社`}
            </span>
          )}
        </div>
        {genre.total_count > 0 && (
          <Link
            href={`/companies?genre=${genre.slug}`}
            className="text-xs text-blue-600 hover:underline flex-shrink-0"
          >
            すべて見る →
          </Link>
        )}
      </div>
      <GenreCarousel companies={genre.companies} />
    </section>
  );
}
