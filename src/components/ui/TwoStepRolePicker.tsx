"use client";

import { useState } from "react";
import { selectStyle } from "@/components/profile/editor/formKit";

/**
 * 職種を **一覧から辿って「追加」する**ための2段セレクト（大分類 → 小分類 → 追加）。
 *
 * ── なぜ `RoleSearchSelect` の中に置けないのか ──────────────────────────────
 * ⚠️ あの部品の2段セレクトは**値が1つの欄**でしか出せない。複数追加式（`clearOnSelect`）に
 *    置くと「選んだ瞬間に追加される」のか「大分類を選んでから小分類を選ぶ」のかが
 *    決まらない。**追加ボタンが要る**ので、こちらに分けてある。
 *
 * ── なぜ共通部品にしたか（2026-09-12）──────────────────────────────────────
 * ⚠️★**`IntentCard` のローカル関数だった**ものをここへ出した。
 *    オンボーディングの「関心のある職種」でも同じものが要るため。
 *    **2つ目の実装を書かないこと。** 職種の入力方式が増えるたびに、
 *    同じ画面で挙動が割れる形の不具合が生まれている（2026-09-11 に3通りあったのを1つに畳んだ）。
 *
 * ⚠️★**検索欄と併用する。** これだけにしないこと —— 2026-08-06 に
 *    「105件を目視で探させる UI は機能していない」と判明している。
 *    逆に検索欄だけにもしない —— **名前を知らない人がほかの分野へ辿り着けない**
 *    （2026-09-12 に「営業の人がカスタマーサクセスに興味を持つこともある」と指摘された）。
 *
 * ⚠️ 候補の配列は呼び出し側が用意する（is_active / 統合済みの除外は呼び出し側の責任）。
 */
export function TwoStepRolePicker({
  roles, disabled, onAdd, ariaLabelPrefix = "職種",
}: {
  roles: { id: string; name: string; parent_id: string | null }[];
  disabled: boolean;
  onAdd: (roleId: string) => void;
  /** `aria-label` の接頭辞。同じ画面に2つ置くときに区別できるようにする */
  ariaLabelPrefix?: string;
}) {
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");
  const parents = roles.filter((r) => !r.parent_id);
  const children = roles.filter((r) => r.parent_id === parentId);
  const picked = childId || parentId;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>または一覧から選ぶ</span>
        <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          aria-label={`${ariaLabelPrefix}（大分類）`}
          value={parentId}
          disabled={disabled}
          onChange={(e) => { setParentId(e.target.value); setChildId(""); }}
          style={{ ...selectStyle(), flex: "1 1 140px" }}
        >
          <option value="">大分類を選ぶ</option>
          {parents.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select
          aria-label={`${ariaLabelPrefix}（小分類）`}
          value={childId}
          disabled={disabled || !parentId || children.length === 0}
          onChange={(e) => setChildId(e.target.value)}
          style={{ ...selectStyle(), flex: "1 1 140px" }}
        >
          <option value="">{!parentId ? "先に大分類を選ぶ" : children.length === 0 ? "小分類なし" : "小分類を選ぶ"}</option>
          {children.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button
          type="button"
          disabled={disabled || !picked}
          onClick={() => { onAdd(picked); setParentId(""); setChildId(""); }}
          style={{
            padding: "0 16px", height: 40, borderRadius: 8, border: "none",
            background: disabled || !picked ? "var(--line)" : "var(--royal)",
            color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
            cursor: disabled || !picked ? "default" : "pointer", flexShrink: 0,
          }}
        >追加</button>
      </div>
      {/* ⚠️ 「大分類だけでも追加できる」ことを書く。書かないと小分類が必須だと思われる。 */}
      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>
        大分類だけでも追加できます。当てはまる小分類があるときだけ選んでください。
      </p>
    </div>
  );
}
