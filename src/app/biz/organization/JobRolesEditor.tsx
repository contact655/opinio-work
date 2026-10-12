"use client";

import Link from "next/link";
import { flattenTree } from "@/lib/business/orgTree";
import type { StandardRole } from "./StandardRoleCombobox";
import type { Department } from "./DepartmentsWorkspace";

export type { StandardRole } from "./StandardRoleCombobox";

export type CompanyJobRole = {
  id: string;
  /** ★親の自社職種。NULL は最上位（2026-09-19）。
   *  ⚠️★**標準職種（`standard_role_id`）の親子とは別物。** あちらは OPINIO のマスタで、こちらは自社の組織の形。 */
  parent_id: string | null;
  name: string;
  standard_role_id: string | null;
  display_order: number;
};

/**
 * ★職種タブ（2026-10-12 / 柴さんの指示で**読むだけの一覧**にした）。
 *   列は 社内での呼び方 / 標準の職種 / 部門 / 求人。部門名を押すと部門タブのその部門のパネルが開く。
 * ⚠️★**ここで編集させないこと。** 職種の追加・標準の職種・呼び方・部門の付け外しは、部門タブのパネルの1か所でやる
 *    （2か所で編集できると、どちらで直したかが分からなくなる）。
 * ⚠️ 紐付けが読めなかったときは部門の列を「—」にする（「部門なし」と見せない）。
 */
export function JobRolesEditor({ roles, standardRoles, departments, roleDepartments, usage }: {
  roles: CompanyJobRole[];
  standardRoles: StandardRole[];
  departments: Department[];
  roleDepartments?: Record<string, string[]>;
  usage?: Record<string, number>;
}) {
  const stdById = new Map(standardRoles.map((r) => [r.id, r]));
  const deptOrder = flattenTree(departments).map(({ node }) => node);
  const ordered = flattenTree(roles);
  const missing = roles.filter((r) => !r.standard_role_id).length;

  return (
    <div>
      <style>{`
        .jrl-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .jrl-table th { text-align: left; font-size: 12px; font-weight: 700; color: var(--ink-soft); padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--bg-tint); white-space: nowrap; }
        .jrl-table td { padding: 10px 14px; border-bottom: 1px solid var(--line-soft); vertical-align: top; color: var(--ink); overflow-wrap: anywhere; }
        .jrl-table tr:last-child td { border-bottom: none; }
        .jrl-dept { color: var(--royal); font-weight: 600; text-decoration: none; }
        .jrl-dept:hover { text-decoration: underline; }
        @media (max-width: 720px) {
          .jrl-table thead { display: none; }
          .jrl-table tr { display: block; padding: 10px 14px; border-bottom: 1px solid var(--line-soft); }
          .jrl-table td { display: block; padding: 2px 0; border: none; }
        }
      `}</style>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        職種の追加・変更は、<Link href="/biz/organization" style={{ color: "var(--royal)", fontWeight: 600 }}>部門タブ</Link>で部門を選んで行います。
        {missing > 0 && <span data-state="standard-role-missing-notice" style={{ color: "var(--ink-mute)" }}>　標準の職種が未設定の職種が{missing}件あります（候補者を探すの「合うところ」には使われません）。</span>}
      </p>
      <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden" }}>
        {ordered.length === 0 ? (
          <p style={{ margin: 0, padding: "18px 16px", fontSize: 13, color: "var(--ink-mute)" }}>職種はまだありません。部門タブで部門を選び、「＋ 新しい職種を追加」から登録できます。</p>
        ) : (
          <table className="jrl-table" data-state="job-roles-list">
            <thead>
              <tr><th>社内での呼び方</th><th>標準の職種</th><th>部門</th><th style={{ textAlign: "right" }}>求人</th></tr>
            </thead>
            <tbody>
              {ordered.map(({ node: r, depth }) => {
                const std = r.standard_role_id ? stdById.get(r.standard_role_id) : undefined;
                const alias = std && std.name === r.name ? null : r.name;
                const depts = roleDepartments ? deptOrder.filter((d) => (roleDepartments[r.id] ?? []).includes(d.id)) : null;
                const used = usage?.[r.id] ?? 0;
                return (
                  <tr key={r.id} data-state="job-role-row">
                    <td style={{ paddingLeft: depth > 1 ? 14 + (depth - 1) * 16 : undefined }}>
                      {alias ?? <span style={{ color: "var(--ink-mute)" }}>—</span>}
                    </td>
                    <td>{std ? std.name : <span data-state="standard-role-missing" style={{ color: "var(--ink-mute)" }}>未設定</span>}</td>
                    <td>
                      {depts === null ? <span style={{ color: "var(--ink-mute)" }}>—</span>
                        : depts.length === 0 ? <span style={{ color: "var(--ink-mute)" }}>部門なし</span>
                        : depts.map((d, i) => (
                          <span key={d.id}>{i > 0 && "、"}<Link className="jrl-dept" href={`/biz/organization?dept=${d.id}`}>{d.name}</Link></span>
                        ))}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap", color: used > 0 ? "var(--ink)" : "var(--ink-mute)" }}>{used > 0 ? `${used}件` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
