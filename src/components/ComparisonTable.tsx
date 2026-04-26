/**
 * Fix 16: 他社比較表
 */

type Cell = "circle" | "double-circle" | "triangle" | "cross" | "dash" | string;

const rows: { label: string; cells: [Cell, Cell, Cell] }[] = [
  { label: "求人数", cells: ["厳選25社", "数万件", "数万件"] },
  { label: "業界特化", cells: ["IT/SaaS", "全業界", "全業界"] },
  { label: "企業取材", cells: ["double-circle", "triangle", "cross"] },
  { label: "メンター相談", cells: ["double-circle", "triangle", "cross"] },
  { label: "営業電話", cells: ["なし", "あり", "dash"] },
  { label: "料金", cells: ["無料", "無料", "無料"] },
  { label: "Opinioの見解", cells: ["double-circle", "cross", "cross"] },
];

const renderCell = (val: Cell, isOpinio: boolean) => {
  const baseStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: isOpinio ? 700 : 500,
    color: isOpinio ? "#1D9E75" : "#374151",
  };
  if (val === "double-circle") {
    return <span style={{ ...baseStyle, fontSize: 18 }}>◎</span>;
  }
  if (val === "circle") {
    return <span style={{ ...baseStyle, fontSize: 16 }}>○</span>;
  }
  if (val === "triangle") {
    return <span style={{ ...baseStyle, color: "#9ca3af", fontSize: 16 }}>△</span>;
  }
  if (val === "cross") {
    return <span style={{ ...baseStyle, color: "#cbd5e1", fontSize: 16 }}>×</span>;
  }
  if (val === "dash") {
    return <span style={{ ...baseStyle, color: "#cbd5e1" }}>−</span>;
  }
  return <span style={baseStyle}>{val}</span>;
};

export function ComparisonTable() {
  return (
    <section style={{ background: "#fff", paddingTop: 64, paddingBottom: 64 }}>
      <div className="max-w-4xl mx-auto px-8">
        <p style={{ fontSize: 12, color: "#1D9E75", fontWeight: 600, letterSpacing: "0.05em", marginBottom: 8 }}>
          COMPARISON
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 700, color: "#0f172a", marginBottom: 8, letterSpacing: "-0.01em" }}>
          他社との違い
        </h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
          正直に書いています。求人数では他社に及びませんが、Opinioだけの強みがあります。
        </p>

        <div style={{ overflow: "auto", borderRadius: 14, border: "0.5px solid #e8e4dc", background: "#fff" }}>
          <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid #e8e4dc" }}>
                <th style={{ padding: "14px 16px", textAlign: "left", fontSize: 11, color: "#6b7280", fontWeight: 500, width: "28%" }}>項目</th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontSize: 14, fontWeight: 700, color: "#1D9E75", background: "#f0fdf4", borderLeft: "2px solid #1D9E75", borderRight: "2px solid #1D9E75" }}>
                  Opinio
                </th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                  大手転職<br />エージェント
                </th>
                <th style={{ padding: "14px 16px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                  求人サイト
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.label} style={{ borderBottom: i < rows.length - 1 ? "0.5px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "14px 16px", fontSize: 12, color: "#6b7280", fontWeight: 500 }}>
                    {row.label}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center", background: "#f0fdf4", borderLeft: "2px solid #1D9E75", borderRight: "2px solid #1D9E75" }}>
                    {renderCell(row.cells[0], true)}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    {renderCell(row.cells[1], false)}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "center" }}>
                    {renderCell(row.cells[2], false)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
