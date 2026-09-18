import { viewerIsAdmin } from "@/lib/auth/adminPageGuard";
import { fetchEvidenceGaps } from "@/lib/admin/evidenceGaps";
import EvidenceGapsClient from "./EvidenceGapsClient";

export const dynamic = "force-dynamic";

/**
 * 「あと何をすれば根拠が立つか」（②⑨の材料の棚卸し / 2026-09-18）。
 *
 * ⚠️★**未回答者を数える画面ではない。** 根拠の型ごとにデータ源が違うので、
 *    型ごとに数えて、足りない分を名指しする。数え方は `lib/admin/evidenceGaps.ts`。
 *
 * ⚠️★**このページは実ユーザーの氏名とメールアドレスを出す。**
 *    ページ本体の先頭で運営権限を確かめること。レイアウトのガードだけでは、
 *    ページが実行されて props が RSC フライトデータとして HTML に載る
 *    （2026-09-18 に `/admin` の6ページで実際に漏れていた。
 *     docs/admin-rsc-leak-20260918.md）。
 */
export default async function EvidenceGapsPage() {
  /* ★★消さないこと。DB を引く前に返す。 */
  if (!(await viewerIsAdmin())) return null; // 画面はレイアウトの「権限がありません」が出す

  const data = await fetchEvidenceGaps();
  /* ⚠️ 取得に失敗したら「0社」と出さない（CLAUDE.md）。null を渡して画面に理由を書かせる */
  return <EvidenceGapsClient data={data} />;
}
