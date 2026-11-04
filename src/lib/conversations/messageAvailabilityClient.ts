/**
 * ★「メッセージ」ボタンを出すか（ブラウザ側）。一覧に何十人並んでも、問い合わせを1回にまとめる（2026-11-03）。
 *   判定はサーバー（GET /api/dm/availability → lib/constants/messageButton.ts の messageButtonVisible）。ここは束ねて配るだけ。
 * ⚠️ 取れなかった人は出さない（送れないボタンを出さない）。
 */
export type MessageAvailability = { show: boolean; connected: boolean };

const cache = new Map<string, Promise<MessageAvailability>>();
let queue: { id: string; resolve: (v: MessageAvailability) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const HIDDEN: MessageAvailability = { show: false, connected: false };
const MAX_PER_REQUEST = 50;

async function flush() {
  const batch = queue;
  queue = [];
  timer = null;
  for (let i = 0; i < batch.length; i += MAX_PER_REQUEST) {
    const part = batch.slice(i, i + MAX_PER_REQUEST);
    let map: Record<string, MessageAvailability> = {};
    try {
      const res = await fetch(`/api/dm/availability?ids=${encodeURIComponent(part.map((p) => p.id).join(","))}`, { cache: "no-store" });
      if (res.ok) map = ((await res.json()) as { availability?: Record<string, MessageAvailability> }).availability ?? {};
    } catch {
      /* 取れなければ出さない */
    }
    for (const p of part) p.resolve(map[p.id] ?? HIDDEN);
  }
}

export function loadMessageAvailability(userId: string): Promise<MessageAvailability> {
  const hit = cache.get(userId);
  if (hit) return hit;
  const p = new Promise<MessageAvailability>((resolve) => {
    queue.push({ id: userId, resolve });
    if (!timer) timer = setTimeout(() => void flush(), 30);
  });
  cache.set(userId, p);
  return p;
}
