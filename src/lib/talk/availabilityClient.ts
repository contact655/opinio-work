/**
 * ★「話を聞く」ボタンを出すか（ブラウザ側）。一覧に何十人並んでも、問い合わせを1回にまとめる（2026-11-03）。
 *   判定はサーバー（GET /api/talk/availability → lib/talk/server.ts の talkProfiles）。ここは束ねて配るだけ。
 * ⚠️ 取れなかった人は出さない（送れないボタンを出さない）。
 */
export type TalkAvailability = { show: boolean; connected: boolean };

const cache = new Map<string, Promise<TalkAvailability>>();
let queue: { id: string; resolve: (v: TalkAvailability) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const HIDDEN: TalkAvailability = { show: false, connected: false };
const MAX_PER_REQUEST = 50;

async function flush() {
  const batch = queue;
  queue = [];
  timer = null;
  for (let i = 0; i < batch.length; i += MAX_PER_REQUEST) {
    const part = batch.slice(i, i + MAX_PER_REQUEST);
    let map: Record<string, TalkAvailability> = {};
    try {
      const res = await fetch(`/api/talk/availability?ids=${encodeURIComponent(part.map((p) => p.id).join(","))}`, { cache: "no-store" });
      if (res.ok) map = ((await res.json()) as { availability?: Record<string, TalkAvailability> }).availability ?? {};
    } catch {
      /* 取れなければ出さない */
    }
    for (const p of part) p.resolve(map[p.id] ?? HIDDEN);
  }
}

export function loadTalkAvailability(userId: string): Promise<TalkAvailability> {
  const hit = cache.get(userId);
  if (hit) return hit;
  const p = new Promise<TalkAvailability>((resolve) => {
    queue.push({ id: userId, resolve });
    if (!timer) timer = setTimeout(() => void flush(), 30);
  });
  cache.set(userId, p);
  return p;
}
