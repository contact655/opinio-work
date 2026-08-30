"use client";

import MergedTimeline, { type CareerEntry } from "@/components/profile/MergedTimeline";

/**
 * `/mypage` と同じ「編集アフォーダンスあり」の形だけを担うクライアント部品。
 *
 * ⚠️★**これを分けたのは、ページをサーバーコンポーネントのままにするため。**
 *    `careerActions` は**関数**なので、サーバーコンポーネントからは境界を越えられない。
 *    ページごと `"use client"` にすると `devOnly()`（`notFound()`）を
 *    ページ自身で呼べなくなり、**本番での遮断が親の layout 頼みになる。**
 *    他の8ページは全部ページ自身で `devOnly()` を呼んでいるので、ここだけ形を変えない。
 *
 * ⚠️ 押しても何も起きないダミー。プレビューは表示の確認だけで、実データを書き換えない。
 */
export function EditableTimeline({ careers }: { careers: CareerEntry[] }) {
  return (
    <MergedTimeline
      careers={careers}
      educations={[]}
      careerActions={{ onEditRow: () => {}, onDeleteRow: () => {}, onAddRole: () => {} }}
    />
  );
}
