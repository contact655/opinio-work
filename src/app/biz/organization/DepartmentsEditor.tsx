"use client";

import { MAX_ORG_DEPTH } from "@/lib/business/orgTree";
import { OrgTreeEditor } from "@/components/business/OrgTreeEditor";

export type Department = {
  id: string;
  parent_id: string | null;
  name: string;
  display_order: number;
};

/**
 * 部門タブ。**中身は職種タブと同じ部品**（`components/business/OrgTreeEditor.tsx`）。
 *
 * ⚠️★**ここに木の描画や追加欄を書き戻さないこと**（2026-09-20 にまとめた）。
 *    それ以前は部門(550行)と職種(737行)が同じ仕組みを別々に持っており、
 *    実際にヒントの文面が揃っていなかった。**違いは「行に1列足すか」だけ。**
 *    部門には足す列が無いので `extra` を渡していない。
 */
export function DepartmentsEditor({ initialDepartments, readOnly = false, usage, roleDepartments, jobRoles = [] }: {
  initialDepartments: Department[];
  readOnly?: boolean;
  usage?: Record<string, number>;
  /** ★職種ごとの所属部門（2026-09-22）。部門の行に「この部門の職種」を出す。編集は職種タブで行う */
  roleDepartments?: Record<string, string[]>;
  jobRoles?: { id: string; name: string }[];
}) {
  const rolesByDept = new Map<string, string[]>();
  if (roleDepartments) {
    for (const r of jobRoles) {
      for (const d of roleDepartments[r.id] ?? []) rolesByDept.set(d, [...(rolesByDept.get(d) ?? []), r.name]);
    }
  }
  return (
    <OrgTreeEditor<Department>
      unit="部門"
      /* ⚠️ 部門の側では読むだけ。付け外しは職種タブの1箇所にする（2箇所で編集させない） */
      rowAddon={(row) => {
        const names = rolesByDept.get(row.id);
        if (!names?.length) return null;
        return (
          <div style={{ fontSize: 12, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>
            この部門の職種：<span style={{ color: "var(--ink-soft)" }}>{names.join("、")}</span>
          </div>
        );
      }}
      endpoint="/api/biz/departments"
      createdKey="department"
      initialRows={initialDepartments}
      readOnly={readOnly}
      usage={usage ? { counts: usage, noun: "求人" } : undefined}
      example="営業部"
      hints={[
        <>下の入力欄は <b>Enter で続けて打ち込めます</b>（Tab で一段下、Shift+Tab で一段上。最大{MAX_ORG_DEPTH}階層）</>,
        <>行の <b>↑ ↓</b> で並べ替え、<b>← →</b> で階層を変えられます</>,
        <>部門名をダブルクリックすると名前を変更できます</>,
        <>部門を削除すると<b>その下の部門も一緒に削除されます</b>。紐づいている求人・社員の記録は残ります</>,
        /* ⚠️★2026-09-19 に「社員登録」を外した。社員登録の「部署」は**自由入力**で、
              部門マスタと繋がっていない。**守れない約束を画面に出さない。**
              社員登録をマスタから選ぶ形にするなら、ここも戻すこと。 */
        <>ここで登録した部門は、求人作成の「所属部門」から選べます</>,
      ]}
    />
  );
}
