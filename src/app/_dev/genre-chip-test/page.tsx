// dev-only: GenreChipSelector 動作確認ページ
// 本番（NODE_ENV !== 'development'）では 404 を返す

import { notFound } from "next/navigation";
import GenreChipTestClient from "./GenreChipTestClient";

export default function GenreChipTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <GenreChipTestClient />;
}
