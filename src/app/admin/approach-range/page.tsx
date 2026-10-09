import { getApproachRangeFieldCoverage } from "@/lib/approaches/range";
import { APPROACH_RANGE_FIELD_MIN_COVERAGE } from "@/lib/constants/approachRange";
import { ApproachRangeFieldToggle } from "./ApproachRangeFieldToggle";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "声かけの受け取り範囲 | OPINIO Admin" } };

const LABELS: Record<string, string> = {
  job_categories: "職種",
  industries: "業種",
  size_groups: "会社規模",
  prefectures: "勤務地",
  remote_ok: "リモート",
};

/**
 * ★声かけを受け取る範囲の項目ごとの割合と有効フラグ（2026-10-10 / 柴さんの指示）。
 * 割合 = 公開中・検証用を除く企業のうち、その項目の手がかり（判定に使える値）を持つ企業。
 * ⚠️ 50% を超えたら運営が有効にする。**自動では切り替えない**（企業1社の登録で範囲が急に変わるため）。
 * ⚠️ 割合の計算は DB 関数 `approach_range_field_coverage()` の1か所。
 */
export default async function AdminApproachRangePage() {
  const rows = await getApproachRangeFieldCoverage();
  return (
    <div style={{ maxWidth: 820 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>声かけの受け取り範囲</h1>
      <p style={{ fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)", margin: "0 0 16px" }}>
        求職者の設定画面に出す項目を選びます。無効の項目は設定画面に出ず、値が入っていても判定に使いません。
        割合が {Math.round(APPROACH_RANGE_FIELD_MIN_COVERAGE * 100)}% を超えたら有効にする目安です（自動では切り替わりません）。
      </p>
      {rows === null ? (
        <p style={{ fontSize: 13, color: "var(--error)" }}>取得できませんでした（0件という意味ではありません）。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
              <th style={{ padding: "10px 8px" }}>項目</th>
              <th style={{ padding: "10px 8px" }}>手がかりを持つ企業</th>
              <th style={{ padding: "10px 8px" }}>割合</th>
              <th style={{ padding: "10px 8px" }}>状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const ratio = r.total > 0 ? r.withClue / r.total : 0;
              const over = ratio >= APPROACH_RANGE_FIELD_MIN_COVERAGE;
              return (
                <tr key={r.field} data-state={r.enabled ? "enabled" : "disabled"} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>{LABELS[r.field] ?? r.field}</td>
                  <td style={{ padding: "10px 8px" }}>{r.withClue} / {r.total}社</td>
                  <td style={{ padding: "10px 8px", fontWeight: 700, color: over ? "var(--ink)" : "var(--ink-mute)" }}>
                    {Math.round(ratio * 100)}%{!over && "（目安未満）"}
                  </td>
                  <td style={{ padding: "10px 8px" }}><ApproachRangeFieldToggle field={r.field} enabled={r.enabled} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
