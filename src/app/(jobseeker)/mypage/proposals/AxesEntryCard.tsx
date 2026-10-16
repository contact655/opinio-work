import Link from "next/link";
import { FIT_AXES, type FitAxisValue } from "@/lib/fitAxes/axes";
import { AxesSummary } from "./axes/AxesClient";

/**
 * ★「相性のものさし」への入口（2026-10-15）。「あなたに合う会社」の冒頭の下にカード1枚。
 *   未作成 … 「自分のAIで、相性のものさしを作る（約3分）」
 *   作成済み … 自分のものさしと「作り直す」
 * ⚠️ 出すかどうかは呼び出し側が fitAxesEnabledFor() で決める（公開スイッチは axes.ts の1か所）
 * ⚠️ いまは並び順に使っていない（プライバシーポリシーの改定後に反映する）。そう書いてある
 */
export default function AxesEntryCard({ values }: { values: Record<string, FitAxisValue> | null }) {
  const has = !!values && Object.keys(values).length > 0;
  return (
    <section data-state={has ? "axes-entry-saved" : "axes-entry-empty"}
      style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px", background: "#fff", margin: "0 0 20px" }}>
      {has ? (
        <>
          <p style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>あなたの相性のものさし</p>
          <AxesSummary axes={FIT_AXES.map((a) => ({ ...a }))} values={values!} />
          <p style={{ margin: "10px 0 0", fontSize: 12 }}>
            <Link href="/mypage/proposals/axes" style={{ color: "var(--royal)", fontWeight: 600 }}>作り直す →</Link>
            <span style={{ color: "var(--ink-soft)", marginLeft: 8 }}>会社には表示されません。</span>
          </p>
        </>
      ) : (
        <Link href="/mypage/proposals/axes" style={{ display: "block", textDecoration: "none", color: "var(--ink)" }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>自分のAIで、相性のものさしを作る（約3分）</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.7 }}>
            ふだん使っている Claude や ChatGPT に質問文を貼り、答えを貼り戻すだけです。会社には表示されません。 →
          </span>
        </Link>
      )}
    </section>
  );
}
