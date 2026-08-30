import { notFound } from "next/navigation";

/**
 * `/dev/preview` を **development でしか開けなくする**（2026-08-30）。
 *
 * ⚠️★**すべてのページの先頭で呼ぶこと。** レイアウトだけに置かない
 *    （`layout.tsx` は子の `generateMetadata` より後に走ることがあり、
 *     ページ単体で守れているほうが確実）。
 *
 * ⚠️ `NODE_ENV` は Next のビルドで静的に置換されるので、本番ビルドでは
 *    この分岐ごと「常に notFound」に畳まれる。**環境変数の設定ミスで開く余地が無い。**
 *
 * ⚠️ ここに「固定データ」以外を持ち込まないこと。DB を読む preview を作ると、
 *    本番のデータを本番の外に出す経路になる。**この配下は DB を触らない。**
 */
export function devOnly(): void {
  if (process.env.NODE_ENV !== "development") notFound();
}
