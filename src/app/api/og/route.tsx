import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

/*
  ⚠️ **`new ImageResponse(...)` をそのまま return しないこと。**（2026-08-25 に作り替えた）

  Next 14 の `ImageResponse`（node_modules/next/dist/server/og/image-response.js）は
  **コンストラクタでヘッダ（200 / image/png）を確定し、実際の描画は
  ReadableStream の start() の中で後から走る**。描画が例外を投げても
  ヘッダは送出済みなので、**5xx にならず「200 かつ空ボディ」になる。**

  実害（本番実測 2026-08-25）:
    2026-05-23 の初回実装（e8129eae）から **1年3か月、バッジ付きの OG 画像が
    1枚も生成されていなかった。** 企業詳細84枚・求人詳細5枚・記事詳細16枚が
    すべて 0 バイト。原因はバッジ pill の `width: "fit-content"` で、
    satori の下の Yoga が `Invalid value fit-content for setWidth` を投げていた。
    **200 が返るので誰も気づけなかった。**

  → だから `await .arrayBuffer()` で**描き切ってから** Response を作る。
     ストリーミングは失われるが、1200×630 の一枚絵（実測50KB前後）なので許容する。

  ⚠️ **catch で無地の画像を返して終わりにしないこと。** それをやると
     「静かに壊れている」状態に戻る。段階を3つに分けてある（下の GET を参照）。
*/

/** 成功時のキャッシュ。⚠️ Next の ImageResponse が付けていた値をそのまま維持している。 */
const CACHE_CONTROL =
  process.env.NODE_ENV === "development"
    ? "no-cache, no-store"
    : "public, immutable, no-transform, max-age=31536000";

/* ⚠️ 縮退（バッジ抜き）で返すときは **immutable にしない。**
      本来出したい画像ではないので、原因を直したあと自然に入れ替わってほしい。 */
const CACHE_CONTROL_DEGRADED = "public, max-age=300";

type CardProps = { name: string; sub: string; badge: string; type: string };

function OgCard({ name, sub, badge, type }: CardProps) {
  return (
    <div
      style={{
        width: "1200px",
        height: "630px",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 80px",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background accent top-right */}
      <div
        style={{
          position: "absolute",
          top: -120,
          right: -120,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,35,102,0.12) 0%, transparent 70%)",
          display: "flex",
        }}
      />
      {/* Background accent bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: -60,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(59,95,217,0.08) 0%, transparent 70%)",
          display: "flex",
        }}
      />

      {/* Top: OPINIO wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 40,
        }}
      >
        <span
          style={{
            fontWeight: 800,
            fontSize: 28,
            color: "#002366",
            letterSpacing: "-0.02em",
          }}
        >
          OPINIO
        </span>
        {type === "company" && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.15em",
              padding: "3px 9px",
              background: "#002366",
              color: "#fff",
              borderRadius: 4,
            }}
          >
            BUSINESS
          </span>
        )}
      </div>

      {/* Badge pill */}
      {badge ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 14px",
            borderRadius: 100,
            background: "#EFF3FC",
            color: "#002366",
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 20,
            /* ⚠️ **`width: "fit-content"` を書き戻さないこと。**
                  satori の下の Yoga が受け付けず、`Invalid value fit-content for
                  setWidth` で描画ごと落ちる（＝200・空ボディ）。
                  Yoga の width は数値・パーセント・auto しか取らない。
               ⚠️ `width` を消すだけにもしないこと。親が column の flex なので
                  幅いっぱいに伸びる。内容幅に収めるのは `alignSelf`。 */
            alignSelf: "flex-start",
          }}
        >
          {badge}
        </div>
      ) : null}

      {/* Name */}
      <div
        style={{
          fontSize: name.length > 20 ? 48 : 60,
          fontWeight: 800,
          color: "#0F172A",
          lineHeight: 1.2,
          marginBottom: 20,
          maxWidth: 900,
        }}
      >
        {name}
      </div>

      {/* Sub */}
      {sub ? (
        <div
          style={{
            fontSize: 24,
            color: "#475569",
            lineHeight: 1.6,
            maxWidth: 800,
          }}
        >
          {sub}
        </div>
      ) : null}

      {/* Bottom: URL */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: 80,
          right: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 18, color: "#94A3B8", fontWeight: 500 }}>
          OPINIO
        </span>
        <span style={{ fontSize: 18, color: "#94A3B8" }}>
          IT/SaaS業界のキャリアインフラ
        </span>
      </div>
    </div>
  );
}

/** 描き切ってから返す。ここで初めて例外が表に出る。 */
async function renderPng(props: CardProps): Promise<ArrayBuffer> {
  return await new ImageResponse(<OgCard {...props} />, {
    width: 1200,
    height: 630,
  }).arrayBuffer();
}

function png(body: ArrayBuffer, cacheControl: string): Response {
  return new Response(body, {
    headers: { "content-type": "image/png", "cache-control": cacheControl },
  });
}

function errText(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  /* ⚠️ **正規のパラメータ名は `name` / `sub`。**
        `title` / `subtitle` は**エイリアス**として受けるだけ。
        2026-08-25 まで受けていなかったため、`?title=企業を探す` と書いていた
        一覧3ページと /business は**見出しが既定値の「OPINIO」のまま**だった
        （落ちないので誰も気づかなかった）。呼び出し元は name / sub に揃えたが、
        次に誰かが直感的な名前で書いても静かに既定値へ落ちないよう両方受ける。 */
  const name = (searchParams.get("name") ?? searchParams.get("title") ?? "OPINIO").slice(0, 100);
  const sub = (searchParams.get("sub") ?? searchParams.get("subtitle") ?? "IT/SaaS業界のキャリアインフラ").slice(0, 120);
  const badge = (searchParams.get("badge") ?? "").slice(0, 50);
  const type = searchParams.get("type") ?? "default";

  /* ⚠️ `v`（キャッシュバスティング用）は**読まない**。URL が変われば
        SNS 側が取り直すので、値そのものに意味は無い。 */

  // ① 通常描画
  try {
    return png(await renderPng({ name, sub, badge, type }), CACHE_CONTROL);
  } catch (e) {
    /* ⚠️ **握りつぶさない。** 何で落ちたかを必ず出す。
          「どのパラメータで落ちたか」まで出さないと、本番のログだけでは再現できない。 */
    console.error(
      `[api/og] 描画に失敗。バッジ抜きで再試行します: ${errText(e)}` +
      ` | type=${JSON.stringify(type)} badge=${JSON.stringify(badge)}` +
      ` name=${JSON.stringify(name)} sub=${JSON.stringify(sub)}`
    );
  }

  // ② バッジ抜きで再描画（badge なしは動作が実証済みの経路）
  try {
    return png(await renderPng({ name, sub, badge: "", type }), CACHE_CONTROL_DEGRADED);
  } catch (e) {
    console.error(
      `[api/og] バッジ抜きでも失敗: ${errText(e)}` +
      ` | type=${JSON.stringify(type)} name=${JSON.stringify(name)} sub=${JSON.stringify(sub)}`
    );
  }

  /* ③ ⚠️ **200 で空を返さない。** それが今回1年3か月見逃された原因そのもの。
        no-store にして、直したあとに壊れた応答が残らないようにする。 */
  return new Response("og image render failed", {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
