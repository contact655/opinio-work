"use client";

import { useEffect, useState } from "react";

const KEY = "opinio_recently_viewed";
const MAX = 8;

export type RecentItem = {
  type: "company" | "job";
  id: string;
  name: string;
  logoUrl?: string | null;
  logoLetter?: string;
  gradient?: string;
};

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function addItem(item: RecentItem) {
    setItems((prev) => {
      const filtered = prev.filter((i) => !(i.type === item.type && i.id === item.id));
      const next = [item, ...filtered].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  function clearItems() {
    setItems([]);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  return { items, addItem, clearItems };
}
