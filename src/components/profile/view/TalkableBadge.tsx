/**
 * 「面談可」バッジ（2026-08-25 に切り出し）。
 *
 * ⚠️ ★**同じ見た目を2箇所に書かないための置き場。** `/u/[id]` の中に直接書いてあり、
 *    `/mypage` に同じものを出すときに複製されかけた（`.claude/rules/ui-debugging.md` ⑧）。
 *
 * ── 出す条件 ────────────────────────────────────────────────────────────────
 * **本人が「話を聞かれてもよい」を ON にしていれば出す**（2026-08-23 に方針変更）。
 * 判定は `lib/companyMembers/talkable.ts` の `isTalkable`。
 *
 * ⚠️ **会社の受付状態では出し分けない。** 申込CTA（カジュアル面談）は別で、
 *    受付中のときだけ出す。**バッジが出ていても申し込めない相手がいる。**
 *
 * ⚠️ 文言は `/people`・企業ページのバッジと揃えること。片方だけ変えない。
 */
/**
 * ⚠️★`size="sm"` は 2026-09-18 に足した（`/biz/employees` のカード用）。
 *    あちらは 10〜11px のバッジが並ぶ行なので、既定の 13px だと1つだけ大きく見える。
 *    ⚠️ **色と文言は共通のまま。** サイズ違いを理由に別の部品を作らないこと
 *    （この部品が在るのは、まさに複製を止めるため）。
 */
export function TalkableBadge({ size = "md" }: { size?: "sm" | "md" } = {}) {
  const sm = size === "sm";
  return (
    <span style={{
      /* ⚠️ 氏名の行は flex（gap: 10）なので marginLeft / verticalAlign は要らない。
            書き足すと間隔が二重になる。 */
      display: "inline-flex", alignItems: "center", gap: sm ? 4 : 5,
      fontSize: sm ? 10 : 13, fontWeight: 700,
      padding: sm ? "1px 7px" : "4px 11px", borderRadius: 100,
      background: "#FFF7ED", color: "#C2410C",
      border: "1px solid #FED7AA", whiteSpace: "nowrap",
    }}>
      <span aria-hidden style={{ width: sm ? 4 : 5, height: sm ? 4 : 5, borderRadius: "50%", background: "#F97316", flexShrink: 0 }} />
      面談OK
    </span>
  );
}
