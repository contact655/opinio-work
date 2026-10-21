"use client";

import { useEffect } from "react";
import { pushRecentSearch } from "@/lib/search/examples";

/** ★検索結果を開いたら「最近の検索」に残す（2026-10-21）。入口（ヘッダー・例・URL）に関係なく、ここ1か所で残す */
export function RecordRecentSearch({ q }: { q: string }) {
  useEffect(() => { pushRecentSearch(q); }, [q]);
  return null;
}
