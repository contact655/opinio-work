"use client";

import { Fragment, useEffect, useState, useTransition } from "react";

// This is a Server Component wrapper — but we need interactivity, so we use a client component approach
// via a separate client file. For simplicity, we do it all in one client file here.

type Role = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  level: number;
  is_active: boolean;
  is_it_saas: boolean;
  merged_into_id: string | null;
  merged_into_name?: string | null;
  alias_count?: number;
  /** 使用数。統合・無効化の判断材料（2026-08-06 追加） */
  experience_count?: number;
  /** 求人の使用数。ow_jobs.role_category_id と ow_job_roles.role_id を job_id で重複除去した数 */
  job_count?: number;
  /** 並び順。**五十音順にしない**。マスタが意図した順序を正とする */
  display_order?: number | null;
};

/** 使用数の表示。0 のときは「—」（0件だと分かればよい） */
function usageLabel(exp: number, job: number) {
  return exp + job === 0 ? null : `職歴${exp} / 求人${job}`;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [showInactive, setShowInactive] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  /** 折りたたんでいる大分類の id。既定は全部開いた状態 */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Merge dialog
  const [mergeRoleId, setMergeRoleId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [isMerging, setIsMerging] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  async function loadRoles() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/roles");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setRoles(data.roles ?? []);
    } catch {
      setError("職種データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(roleId: string, currentlyActive: boolean) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/roles", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId, action: "toggle_active", value: !currentlyActive }),
        });
        if (!res.ok) throw new Error("Failed");
        setRoles((prev) =>
          prev.map((r) => (r.id === roleId ? { ...r, is_active: !currentlyActive } : r))
        );
      } catch {
        alert("更新に失敗しました");
      }
    });
  }

  async function doMerge() {
    if (!mergeRoleId || !mergeTargetId) return;
    setIsMerging(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: mergeRoleId, action: "merge", mergeIntoId: mergeTargetId }),
      });
      if (!res.ok) throw new Error("Failed");
      setMergeRoleId(null);
      setMergeTargetId("");
      await loadRoles();
    } catch {
      alert("統合に失敗しました");
    } finally {
      setIsMerging(false);
    }
  }

  const q = searchQ.trim().toLowerCase();
  const isSearching = q.length > 0;

  const filtered = roles.filter((r) => {
    if (!showInactive && !r.is_active) return false;
    if (q && !r.name.toLowerCase().includes(q) && !r.slug.toLowerCase().includes(q)) return false;
    return true;
  });

  const parentRoles = roles.filter((r) => !r.parent_id && r.is_active);

  /** id → 大分類の名前。検索結果のパンくずに使う */
  const topNameById = new Map(roles.filter((r) => !r.parent_id).map((r) => [r.id, r.name]));
  const breadcrumbOf = (r: Role) =>
    r.parent_id ? (topNameById.get(r.parent_id) ?? "（親不明）") : null;

  const byOrder = (a: Role, b: Role) =>
    (a.display_order ?? 9999) - (b.display_order ?? 9999) || a.name.localeCompare(b.name, "ja");

  /*
    大分類ごとのセクション。
    ⚠️ 子を持たない大分類（非IT系7件など）も**見出しを出す**。
       大分類そのものも職種として選ばれうるので、行としても出す。
    ⚠️ showInactive の絞り込みは filtered で済ませてある。ここでは並べ替えだけ。
  */
  const sections = roles
    .filter((r) => !r.parent_id)
    .sort(byOrder)
    .map((top) => {
      const self = filtered.find((r) => r.id === top.id) ?? null;
      const children = filtered.filter((r) => r.parent_id === top.id).sort(byOrder);
      const rows = [...(self ? [self] : []), ...children];
      return {
        top,
        rows,
        childCount: children.length,
        // 使用数の合計は**大分類自身＋子**。行として出しているものと一致させる
        expSum: rows.reduce((n, r) => n + (r.experience_count ?? 0), 0),
        jobSum: rows.reduce((n, r) => n + (r.job_count ?? 0), 0),
      };
    })
    // 検索していないときは空セクションも出す（子職種なしと分かるように）。
    // 検索中はフラット表示なのでここは使わない
    .filter((sec) => sec.rows.length > 0 || !isSearching);

  /** 1行ぶんの描画。セクション表示と検索時のフラット表示で共用する */
  function renderRow(role: Role, breadcrumb: string | null) {
    return (
      <tr key={role.id} style={{ borderBottom: "1px solid var(--line-soft)", opacity: role.is_active ? 1 : 0.5, background: role.merged_into_id ? "#fffbeb" : role.is_active ? "#fff" : "#fafafa" }}>
        <td style={{ padding: "9px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: breadcrumb ? 0 : (role.parent_id ? 22 : 0) }}>
            {breadcrumb && (
              <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{breadcrumb} ›</span>
            )}
            <span style={{ fontWeight: role.parent_id ? 500 : 700, color: "var(--ink)" }}>{role.name}</span>
            {role.alias_count && role.alias_count > 0 ? (
              <span style={{ fontSize: 10, background: "var(--royal-50)", color: "var(--royal)", padding: "1px 6px", borderRadius: 100 }}>
                別名 {role.alias_count}
              </span>
            ) : null}
          </div>
        </td>
        <td style={{ padding: "9px 12px", color: "var(--ink-mute)", fontFamily: "monospace", fontSize: 11 }}>{role.slug}</td>
        <td style={{ padding: "9px 12px", textAlign: "center" }}>
          {role.is_it_saas && <span style={{ fontSize: 12 }}>✓</span>}
        </td>
        <td style={{ padding: "9px 12px", textAlign: "center", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif", fontSize: 11 }}>
          {usageLabel(role.experience_count ?? 0, role.job_count ?? 0) === null ? (
            <span style={{ color: "var(--ink-mute)" }}>—</span>
          ) : (
            <span style={{ color: "var(--ink)" }}>
              職歴{role.experience_count ?? 0} / 求人{role.job_count ?? 0}
            </span>
          )}
        </td>
        <td style={{ padding: "9px 12px", textAlign: "center" }}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => toggleActive(role.id, role.is_active)}
            style={{ padding: "3px 10px", borderRadius: 100, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit", background: role.is_active ? "var(--success-soft)" : "#f1f5f9", color: role.is_active ? "var(--success)" : "var(--ink-mute)" }}
          >
            {role.is_active ? "有効" : "無効"}
          </button>
        </td>
        <td style={{ padding: "9px 12px", color: "var(--ink-mute)", fontSize: 12 }}>
          {role.merged_into_name && (
            <span style={{ color: "#92400e", background: "#fef3c7", padding: "2px 8px", borderRadius: 6 }}>
              → {role.merged_into_name}
            </span>
          )}
        </td>
        <td style={{ padding: "9px 12px", textAlign: "center" }}>
          {!role.merged_into_id && (
            <button
              type="button"
              onClick={() => { setMergeRoleId(role.id); setMergeTargetId(""); }}
              style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
            >
              統合
            </button>
          )}
        </td>
      </tr>
    );
  }

  const allTopIds = sections.map((s) => s.top.id);
  const allCollapsed = allTopIds.length > 0 && allTopIds.every((id) => collapsed.has(id));

  const mergeCandidate = roles.find((r) => r.id === mergeRoleId);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>職種マスタ管理</h1>
        <span style={{ fontSize: 12, background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: 100, fontWeight: 700 }}>ADMIN</span>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="職種名・スラグで検索..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, width: 220, fontFamily: "inherit", outline: "none" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-soft)", cursor: "pointer" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          無効な職種も表示
        </label>
        {!isSearching && (
          <button
            type="button"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allTopIds))}
            style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
          >
            {allCollapsed ? "すべて展開する" : "すべて折りたたむ"}
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-mute)" }}>
          {isSearching && <span style={{ marginRight: 8 }}>検索中はフラット表示</span>}
          {filtered.length} / {roles.length} 件
        </span>
      </div>

      {loading && <div style={{ color: "var(--ink-mute)", fontSize: 14 }}>読み込み中...</div>}
      {error && <div style={{ color: "var(--error)", fontSize: 14 }}>{error}</div>}

      {!loading && !error && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-tint)", borderBottom: "1px solid var(--line)" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--ink-mute)", fontSize: 11 }}>職種名</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--ink-mute)", fontSize: 11 }}>スラグ</th>
                {/*
                  ⚠️ 見出しは「求人で使う」。カラム名は is_it_saas のままだが、
                     2026-08-06 に意味を「OPINIO の掲載企業（SaaS/IT）の求人で使う職種か」に
                     再定義した。旧「IT/SaaS」だと業界特有かどうかに読めて実態と合わない。
                */}
                <th title="企業の求人フォームの選択肢に出すか（ow_roles.is_it_saas）。ユーザーの職歴入力では絞っていません"
                    style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "var(--ink-mute)", fontSize: 11 }}>求人で使う</th>
                {/* 使用数 — 統合・無効化の判断材料。0件が一目で分かればよい */}
                <th title="この職種を指している職歴と求人の件数。求人は ow_jobs と ow_job_roles を重複なく数えています"
                    style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "var(--ink-mute)", fontSize: 11 }}>使用数</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "var(--ink-mute)", fontSize: 11 }}>状態</th>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "var(--ink-mute)", fontSize: 11 }}>統合先</th>
                <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 700, color: "var(--ink-mute)", fontSize: 11 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {/* 検索中はフラット。階層のまま出すと、1件ヒットするたびに
                  親の見出しだけが並んで読みにくい（各行にパンくずを出す） */}
              {isSearching && filtered.map((role) => renderRow(role, breadcrumbOf(role)))}

              {!isSearching && sections.map((sec) => {
                const isCollapsed = collapsed.has(sec.top.id);
                return (
                  <Fragment key={sec.top.id}>
                    <tr style={{ background: "var(--bg-tint)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <button
                          type="button"
                          onClick={() => setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(sec.top.id)) next.delete(sec.top.id); else next.add(sec.top.id);
                            return next;
                          })}
                          aria-expanded={!isCollapsed}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, width: "100%",
                            padding: "8px 12px", border: "none", background: "none",
                            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink-mute)" strokeWidth="3" strokeLinecap="round" aria-hidden="true"
                               style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s", flexShrink: 0 }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)" }}>{sec.top.name}</span>
                          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                            子職種 {sec.childCount}件
                          </span>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-mute)", fontFamily: "Inter, sans-serif" }}>
                            {usageLabel(sec.expSum, sec.jobSum) ?? "使用なし"}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!isCollapsed && sec.rows.map((role) => renderRow(role, null))}
                    {!isCollapsed && sec.childCount === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: "6px 12px 6px 34px", fontSize: 11, color: "var(--ink-mute)" }}>
                          子職種なし
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>
                    該当する職種がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Merge dialog */}
      {mergeRoleId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 6px" }}>職種を統合</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 20px" }}>
              「{mergeCandidate?.name}」を別の職種に統合します。<br />
              統合後、この職種は無効になり別名として扱われます。
            </p>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-mute)", display: "block", marginBottom: 6 }}>統合先の職種</label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, fontFamily: "inherit", marginBottom: 20, outline: "none" }}
            >
              <option value="">選択してください</option>
              {parentRoles.filter((r) => r.id !== mergeRoleId).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setMergeRoleId(null)} style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", color: "var(--ink)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                キャンセル
              </button>
              <button
                type="button"
                disabled={!mergeTargetId || isMerging}
                onClick={doMerge}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: !mergeTargetId || isMerging ? "#e2e8f0" : "var(--royal)", color: !mergeTargetId || isMerging ? "var(--ink-mute)" : "#fff", fontSize: 13, fontWeight: 700, cursor: !mergeTargetId || isMerging ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                {isMerging ? "統合中..." : "統合する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
