"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { buildRoleTree } from "@/lib/roles/jobRoles";
import { MAX_ORG_DEPTH } from "@/lib/business/orgTree";
import { OrgTreeEditor } from "@/components/business/OrgTreeEditor";

export type CompanyJobRole = {
  id: string;
  /** ★親の自社職種。NULL は最上位（2026-09-19 / 柴さんの指示で階層にした）。
   *  ⚠️★**標準職種（`standard_role_id`）の親子とは別物。** あちらは OPINIO のマスタで、
   *     こちらは自社の組織の形。混ぜないこと。 */
  parent_id: string | null;
  name: string;
  standard_role_id: string | null;
  display_order: number;
};

export type StandardRole = {
  id: string;
  name: string;
  parent_id: string | null;
  /** ⚠️ **親ごとの相対順**。フラットに並べると親子が混ざる（CLAUDE.md） */
  display_order: number | null;
};

type Props = {
  initialRoles: CompanyJobRole[];
  standardRoles: StandardRole[];
  /** ★管理者でない人は閲覧だけ（2026-09-22）。`OrgTreeEditor` の readOnly を読む */
  readOnly?: boolean;
  /** ★行ごとの求人の件数（2026-09-22）。id → 件数 */
  usage?: Record<string, number>;
};

function StandardRoleBadge({ roleId, roles }: { roleId: string | null; roles: StandardRole[] }) {
  if (!roleId) return null;
  const role = roles.find((r) => r.id === roleId);
  if (!role) return null;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      padding: "1px 7px",
      borderRadius: 100,
      fontSize: 11,
      fontWeight: 600,
      background: "var(--royal-50)",
      color: "var(--royal)",
      border: "1px solid var(--royal-100)",
      flexShrink: 0,
    }}>
      {role.name}
    </span>
  );
}

function StandardRoleCombobox({
  value,
  onChange,
  roles,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  roles: StandardRole[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /* ★木に組んでから出す（2026-09-05 修正）。
     ── 何が起きていたか ──────────────────────────────────────────────────
     `filtered` を**そのまま map** しており、`display_order` が
     **親ごとの相対順**であることを踏まえていなかった。実測（本番データ・154件）:
       先頭22件が全部**子**で、最初の親（経営・CxO）が出るのは **23番目**。
       「CEO・代表取締役」が8番目に出て、親はその15行あとにあった。
     ⚠️ `ow_roles` の子には `display_order = 0` の行があるので、
        「たまたま親が先に来る」ことも無い。

     ── 直し方は `RoleSearchSelect` に揃えた ────────────────────────────────
     親（`tree.topLevel`）→ その子 の順に組み、**子には親名を出す**
     （`{親名} ›` を小さく前置。あちらと同じ表現）。
     ⚠️ **新しい組み方を発明しない。** 並べ方も見せ方もあちらと同じにする。
     ⚠️★ただし**初期表示で子を畳む挙動は持ち込んでいない。** あちらは検索欄が
        空のとき大分類だけを出すが、ここは154件を一覧する前提の画面なので、
        **件数（集合）は変えず並びだけを直す**に留めた。 */
  const tree = useMemo(
    () => buildRoleTree(roles.map((r, i) => ({
      id: r.id,
      parentId: r.parent_id,
      name: r.name,
      slug: null,
      /* ⚠️ `display_order` が無い行は**渡された順**を使う。
            `page.tsx` が display_order → name で並べているので、順序は保たれる。 */
      displayOrder: r.display_order ?? i,
    }))),
    [roles],
  );
  const parentMap = useMemo(
    () => new Map(tree.topLevel.map((r) => [r.id, r.name])),
    [tree],
  );
  /** 親 id → 子。⚠️ 渡された順（＝display_order 順）を保つ */
  const childrenOf = useMemo(() => {
    const m = new Map<string, StandardRole[]>();
    for (const r of roles) {
      if (!r.parent_id) continue;
      if (!m.has(r.parent_id)) m.set(r.parent_id, []);
      m.get(r.parent_id)!.push(r);
    }
    return m;
  }, [roles]);

  const getSelectedLabel = () => {
    if (!value) return "";
    const role = roles.find((r) => r.id === value);
    if (!role) return "";
    if (!role.parent_id) return role.name;
    return `${parentMap.get(role.parent_id) ?? ""} › ${role.name}`;
  };

  /* ⚠️★**マッチ条件は変えない**（2026-09-05）。集合を変えずに並びだけ直す。
        子は「親名 or 自分の名前」に部分一致で当たる、という既存の挙動をそのまま残す。 */
  const filtered = roles.filter((r) => {
    if (!query) return true;
    if (!r.parent_id) {
      return r.name.includes(query);
    }
    const parent = parentMap.get(r.parent_id) ?? "";
    return parent.includes(query) || r.name.includes(query);
  });

  /* ★`filtered` を**親 → その子** の順に並べ替える。
     ⚠️ **絞り込んでも親子の構造を保つ。** 子だけがヒットしたときは親の行は出ないが、
        子の行に親名を出しているので何の下かは読める。
     ⚠️★**1件も落とさないこと。** 親が `roles` に無い孤児は末尾に付ける。
        落とすと「絞り込んだら候補が消えた」になり、集合が変わってしまう。 */
  const rows = useMemo(() => {
    const keep = new Set(filtered.map((r) => r.id));
    const out: StandardRole[] = [];
    const emitted = new Set<string>();
    for (const top of tree.topLevel) {
      const self = roles.find((r) => r.id === top.id);
      if (self && keep.has(top.id)) { out.push(self); emitted.add(top.id); }
      for (const c of childrenOf.get(top.id) ?? []) {
        if (keep.has(c.id)) { out.push(c); emitted.add(c.id); }
      }
    }
    for (const r of filtered) if (!emitted.has(r.id)) out.push(r);
    return out;
  }, [filtered, tree, childrenOf, roles]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handleSelect(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  return (
    <div ref={containerRef} style={{ position: "relative", minWidth: 200 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          border: `1px solid ${open ? "var(--accent)" : "var(--line)"}`,
          borderRadius: 5,
          background: "#fff",
          cursor: "text",
          padding: "3px 6px 3px 8px",
          gap: 4,
        }}
        onClick={() => { if (!open) { setOpen(true); setQuery(""); } }}
      >
        <input
          value={open ? query : getSelectedLabel()}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (!open) setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setQuery(""); }
            if (e.key === "Enter" && filtered.length === 1) { handleSelect(filtered[0].id); }
          }}
          placeholder={open ? "検索…" : (placeholder ?? "標準職種（任意）")}
          style={{
            flex: 1,
            fontSize: 12,
            fontFamily: "inherit",
            border: "none",
            outline: "none",
            background: "transparent",
            color: (value && !open) ? "var(--ink)" : "var(--ink-soft)",
            minWidth: 0,
          }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{ fontSize: 11, color: "var(--ink-mute)", border: "none", background: "none", cursor: "pointer", padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
          >
            ✕
          </button>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, color: "var(--ink-mute)", pointerEvents: "none" }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>

      {open && (
        <ul
          ref={listRef}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 260,
            overflowY: "auto",
            background: "#fff",
            border: "1px solid var(--line)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            zIndex: 100,
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
          }}
        >
          {/* 未設定に戻す */}
          <li
            onClick={() => handleSelect("")}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              color: "var(--ink-mute)",
              cursor: "pointer",
              borderBottom: "1px solid var(--line-soft)",
              marginBottom: 2,
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            紐づけなし
          </li>

          {filtered.length === 0 ? (
            <li style={{ padding: "8px 12px", fontSize: 12, color: "var(--ink-mute)" }}>
              該当なし
            </li>
          ) : (
            <>
              {rows.length > 20 && (
                <li style={{ padding: "4px 12px", fontSize: 11, color: "var(--ink-mute)" }}>
                  {rows.length} 件 — 絞り込むと候補が減ります
                </li>
              )}
              {rows.map((r) => {
                const isParent = !r.parent_id;
                const parentName = r.parent_id ? (parentMap.get(r.parent_id) ?? "") : "";
                return (
                  <li
                    key={r.id}
                    onClick={() => handleSelect(r.id)}
                    style={{
                      padding: isParent ? "6px 12px" : "5px 12px 5px 22px",
                      fontSize: 12,
                      fontWeight: isParent ? 700 : 400,
                      color: isParent ? "var(--ink)" : "var(--ink-soft)",
                      cursor: "pointer",
                      background: r.id === value ? "var(--royal-50)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (r.id !== value) (e.currentTarget as HTMLElement).style.background = "var(--bg-tint)"; }}
                    onMouseLeave={(e) => { if (r.id !== value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* ★子には**常に**親名を出す（2026-09-05）。
                           以前は検索中だけ出しており、初期表示ではインデント22pxだけだったので
                           「何の下の職種か」が読めなかった。表現は `RoleSearchSelect` に合わせる。 */}
                    {!isParent && parentName && (
                      <span style={{ fontSize: 11, color: "var(--ink-mute)", marginRight: 6 }}>
                        {parentName} ›
                      </span>
                    )}
                    {isParent ? r.name : (query ? <strong>{r.name}</strong> : r.name)}
                  </li>
                );
              })}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * 職種タブ。**中身は部門タブと同じ部品**（`components/business/OrgTreeEditor.tsx`）。
 *
 * ⚠️★**ここに木の描画や追加欄を書き戻さないこと**（2026-09-20 にまとめた）。
 *    部門との違いは**「標準職種」の1列だけ**で、それを `extra` で渡している。
 *    振る舞いを変えたくなったら、この列ではなく部品側の props を足すこと。
 *
 * ⚠️★`standard_role_id`（OPINIO のマスタ）と `parent_id`（自社の組織の形）は**別物**。
 *    前者は求人検索・マッチングの分類、後者は画面の階層。混ぜないこと。
 */
export function JobRolesEditor({ initialRoles, standardRoles, readOnly = false, usage }: Props) {
  return (
    <OrgTreeEditor<CompanyJobRole>
      unit="職種"
      readOnly={readOnly}
      usage={usage ? { counts: usage, noun: "求人" } : undefined}
      endpoint="/api/biz/job-roles"
      createdKey="jobRole"
      initialRows={initialRoles}
      example="フィールドセールス"
      extra={{
        view: (row) => <StandardRoleBadge roleId={row.standard_role_id} roles={standardRoles} />,
        input: (value, onChange) => (
          <StandardRoleCombobox value={value} onChange={onChange} roles={standardRoles} />
        ),
        valueOf: (row) => row.standard_role_id ?? "",
        /* ⚠️ 空文字は「紐づけなし」。**null で送る**（"" のまま送ると
              uuid の列に空文字が入って 400 になる）。 */
        toBody: (value) => ({ standard_role_id: value || null }),
      }}
      hints={[
        <>下の入力欄は <b>Enter で続けて打ち込めます</b>（Tab で一段下、Shift+Tab で一段上。最大{MAX_ORG_DEPTH}階層）</>,
        <>行の <b>↑ ↓</b> で並べ替え、<b>← →</b> で階層を変えられます</>,
        <>職種名は社内で使っている呼び方で構いません（例：FS, AE, IC などの略称も可）</>,
        <><b>標準職種</b>と紐づけると、OPINIO の求人検索・マッチングで正しく分類されます</>,
        <>職種名をダブルクリックすると名前を変更できます</>,
        <>削除すると<b>その下の職種も一緒に削除されます</b>。紐づいた求人の記録は残ります</>,
      ]}
    />
  );
}
