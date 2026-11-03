"use client";

import { useState } from "react";
import JobChangeDialog from "@/components/profile/editor/JobChangeDialog";

/* ★画面いっぱいに重なるので、1つずつ開いて見る。⚠️ DB には読みも書きもしない */
const CASES = [
  { key: "choose", label: "① 転職か修正かを聞く", from: "株式会社セールスフォース・ジャパン", to: "HubSpot Japan株式会社", started: "2024-04", step: "choose" as const },
  { key: "end", label: "② 辞めた月を聞く", from: "株式会社セールスフォース・ジャパン", to: "HubSpot Japan株式会社", started: "2024-04", step: "end" as const },
  { key: "long", label: "③ 長い会社名（折り返し）", from: "株式会社とても長い名前のサンプルカンパニー・ホールディングス・ジャパン", to: "合同会社もうひとつのとても長い名前のサンプル・テクノロジーズ", started: "2019-04", step: "choose" as const },
  { key: "recent", label: "④ 今月入社（辞めた月は今月だけ選べる）", from: "株式会社サンプル", to: "株式会社つぎのサンプル", started: new Date().toISOString().slice(0, 7), step: "end" as const },
];

export function JobChangeDemo() {
  const [open, setOpen] = useState<string | null>(null);
  const [last, setLast] = useState<string>("");
  const c = CASES.find((x) => x.key === open);
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CASES.map((x) => (
          <button key={x.key} type="button" data-case={x.key} onClick={() => setOpen(x.key)}
            style={{ padding: "8px 14px", borderRadius: 999, border: "1px solid var(--line)", background: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>
            {x.label}
          </button>
        ))}
      </div>
      <p data-state="job-change-demo-last" style={{ marginTop: 12, fontSize: 13, color: "var(--ink-soft)" }}>{last ? `押したもの: ${last}` : "（まだ何も押していない）"}</p>
      {c && (
        <JobChangeDialog
          key={c.key}
          fromCompany={c.from}
          toCompany={c.to}
          latestStartedAt={c.started}
          initialStep={c.step}
          onCorrection={() => { setLast("会社名の修正です"); setOpen(null); }}
          onJobChange={(ym) => { setLast(`転職しました（辞めた月 ${ym}）`); setOpen(null); }}
          onCancel={() => { setLast("キャンセル"); setOpen(null); }}
        />
      )}
    </div>
  );
}
