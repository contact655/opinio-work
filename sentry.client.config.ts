import * as Sentry from "@sentry/nextjs";
import { viewportBand } from "@/lib/constants/splitView";

/** 既定のトレース採取率。⚠️ `/companies` だけ下の `tracesSampler` で引き上げている。 */
const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

/**
 * ★ビューポート幅の帯をタグに載せる（2026-09-08）。
 *
 * ── 何のために ──────────────────────────────────────────────────────────────
 * `/companies` の分割ビューは **1280px 以上でしか出ない**。その層が実際に
 * どれだけ居るのかを、**推測ではなく実測で**答えられるようにするため。
 * 分割ビューにこれ以上投資するかどうかの判断がこれに乗る。
 *
 * ⚠️★**これは「エラーを出した人」の統計ではない。** タグは
 *    `beforeSendTransaction` にも掛けてあるので、**ふつうに読み込まれた
 *    ページロードのトレース**にも付く。エラー側だけに付けると
 *    「不具合を踏んだ人の画面幅」という偏った標本になる。
 *
 * ⚠️ 送信時に評価する（init 時に `setTag` で控えない）。控えると、
 *    途中でウィンドウを変えた人が読み込み時の幅のまま記録される。
 *
 * ⚠️ **タグは1つだけにしてある。**「1280以上かどうか」の真偽値を別に足したく
 *    なるが、しきい値が変わった日に帯と食い違う。帯を足し合わせれば出る。
 *
 * ⚠️ **クローラを除外していない。** JS を実行する検索エンジンのボットは
 *    この標本に混ざる。クライアント側でボットを見分ける確実な方法が無いため、
 *    **除外しようとせず「混ざっている」と分かった上で読む。**
 */
function tagViewport<T extends Sentry.Event>(event: T): T {
  if (typeof window === "undefined") return event;
  const w = window.innerWidth;
  if (!w) return event;
  event.tags = { ...event.tags, viewport: viewportBand(w) };
  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  /**
   * ⚠️ `tracesSampleRate` は書かない（`tracesSampler` があるとそちらが勝つので、
   *    両方あると「どちらが効いているのか」が読めなくなる）。
   *
   * ⚠️★**`/companies` だけ全件にしてある。** 既定の 10% では、このサイトの
   *    アクセス量だと幅の分布を判断できる件数がたまるまで何か月もかかる。
   *    ⚠️ **知りたいことが分かったら 10% に戻すこと**（この分岐を消すだけ）。
   *       入れっぱなしにすると Sentry の枠を毎月使い続ける。
   */
  tracesSampler: () => {
    if (typeof window !== "undefined" && window.location.pathname === "/companies") return 1.0;
    return DEFAULT_TRACES_SAMPLE_RATE;
  },
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  /* ⚠️ エラーとトレースの**両方**に掛ける。片方だけだと標本が偏る（上の注記）。 */
  beforeSend: (event) => tagViewport(event),
  beforeSendTransaction: (event) => tagViewport(event),
  enabled: process.env.NODE_ENV === "production",
});
