"use client";

import { useState, useTransition, useMemo } from "react";
import { TOOL_CATEGORY_LABELS, TOOL_CATEGORY_ORDER } from "@/lib/utils/toolCfg";
import {
  addCompanyTool,
  removeCompanyTool,
  updateCompanyToolNote,
  createToolMasterAndAdd,
} from "./toolActions";
import type { ToolMaster, CompanyToolRow } from "./toolActions";

// ── 検索ヘルパー ───────────────────────────────────────────────────────────────

function matchTool(tool: ToolMaster, q: string): { matched: boolean; aliasHit: string | null } {
  if (!q) return { matched: true, aliasHit: null };
  const lower = q.toLowerCase();
  if (tool.name.toLowerCase().includes(lower)) return { matched: true, aliasHit: null };
  const hitAlias = tool.aliases.find((a) => a.toLowerCase().includes(lower));
  if (hitAlias) return { matched: true, aliasHit: hitAlias };
  return { matched: false, aliasHit: null };
}

// 新規マスタ名が既存の name/aliases と重複しているか確認
function findDuplicate(name: string, masters: ToolMaster[]): ToolMaster | null {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  return (
    masters.find(
      (m) =>
        m.name.toLowerCase() === lower ||
        m.aliases.some((a) => a.toLowerCase() === lower),
    ) ?? null
  );
}

// ── コンポーネント ─────────────────────────────────────────────────────────────

type Props = {
  companyId: string;
  initialTools: CompanyToolRow[];
  allMasters: ToolMaster[];
};

export default function CompanyToolsTab({ companyId, initialTools, allMasters }: Props) {
  const [tools, setTools] = useState<CompanyToolRow[]>(initialTools);
  const [isPending, startTransition] = useTransition();

  // ── 追加パネル ────────────────────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  // ── 新規マスタフォーム ────────────────────────────────────────────────────
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("other");
  const [newAliases, setNewAliases] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newError, setNewError] = useState("");

  // ── note 編集 ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");

  // ── toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // ── 追加済み tool_id の Set ───────────────────────────────────────────────
  const addedIds = useMemo(() => new Set(tools.map((t) => t.tool_id)), [tools]);

  // ── 検索結果 ──────────────────────────────────────────────────────────────
  const searchResults = useMemo((): Array<{ master: ToolMaster; aliasHit: string | null }> => {
    return allMasters
      .map((m) => ({ master: m, ...matchTool(m, searchQ) }))
      .filter((r) => r.matched)
      .sort((a, b) => {
        // 既に追加済みは末尾へ
        const aAdded = addedIds.has(a.master.id) ? 1 : 0;
        const bAdded = addedIds.has(b.master.id) ? 1 : 0;
        return aAdded - bAdded;
      });
  }, [allMasters, searchQ, addedIds]);

  // 新規マスタ名の重複チェック
  const dupWarning = useMemo(
    (): ToolMaster | null => findDuplicate(newName, allMasters),
    [newName, allMasters],
  );

  // ── ツールを追加（マスタ選択） ────────────────────────────────────────────
  function handleSelect(master: ToolMaster) {
    if (addedIds.has(master.id)) return;
    startTransition(async () => {
      const res = await addCompanyTool(companyId, master.id, "");
      if (res.error) {
        showToast(res.error, false);
        return;
      }
      const newRow: CompanyToolRow = {
        id: crypto.randomUUID(),
        tool_id: master.id,
        note: null,
        sort_order: tools.length + 1,
        created_at: new Date().toISOString(),
        name: master.name,
        category: master.category,
      };
      setTools((prev) => [...prev, newRow]);
      showToast(`${master.name} を追加しました`);
      setSearchQ("");
      setShowAdd(false);
    });
  }

  // ── 削除 ──────────────────────────────────────────────────────────────────
  function handleRemove(row: CompanyToolRow) {
    startTransition(async () => {
      const res = await removeCompanyTool(companyId, row.id);
      if (res.error) { showToast(res.error, false); return; }
      setTools((prev) => prev.filter((t) => t.id !== row.id));
      showToast(`${row.name} を削除しました`);
    });
  }

  // ── note 保存 ─────────────────────────────────────────────────────────────
  function handleSaveNote(row: CompanyToolRow) {
    startTransition(async () => {
      const res = await updateCompanyToolNote(companyId, row.id, editingNote);
      if (res.error) { showToast(res.error, false); return; }
      setTools((prev) =>
        prev.map((t) => t.id === row.id ? { ...t, note: editingNote.trim() || null } : t),
      );
      setEditingId(null);
      showToast("補足を保存しました");
    });
  }

  // ── 新規マスタ追加 ────────────────────────────────────────────────────────
  function handleCreateMaster() {
    if (!newName.trim()) { setNewError("ツール名を入力してください"); return; }
    if (dupWarning) { setNewError(`「${dupWarning.name}」として既に登録されています。検索欄でそちらを選択してください。`); return; }
    startTransition(async () => {
      const res = await createToolMasterAndAdd(companyId, newName, newCategory, newAliases, newNote);
      if (res.error) { setNewError(res.error); return; }
      // サーバーリロードで tools を最新化するため、簡易的に追加行を挿入
      const tempRow: CompanyToolRow = {
        id: crypto.randomUUID(),
        tool_id: crypto.randomUUID(),
        note: newNote.trim() || null,
        sort_order: tools.length + 1,
        created_at: new Date().toISOString(),
        name: newName.trim(),
        category: newCategory,
      };
      setTools((prev) => [...prev, tempRow]);
      showToast(`${newName.trim()} をマスタに追加して選択しました`);
      setNewName(""); setNewCategory("other"); setNewAliases(""); setNewNote(""); setNewError("");
      setShowNewForm(false);
      setShowAdd(false);
    });
  }

  // ── カテゴリ別グループ ────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, CompanyToolRow[]>();
    for (const t of tools) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return map;
  }, [tools]);

  const orderedCats = TOOL_CATEGORY_ORDER.filter((c) => grouped.has(c));

  // ── スタイル定数 ──────────────────────────────────────────────────────────
  const inputCls = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const btnSm = "px-3 py-1.5 text-xs rounded-md font-medium";

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-6 relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">ツール・技術スタック</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            企業が社内で実際に使っているツール。取材時に確認した情報のみ入力すること。
          </p>
        </div>
        {!showAdd && (
          <button
            type="button"
            onClick={() => { setShowAdd(true); setShowNewForm(false); setSearchQ(""); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            <span>＋ ツールを追加</span>
          </button>
        )}
      </div>

      {/* ── 選択済みツール（カテゴリ別） ──────────────────────────────── */}
      {tools.length === 0 && !showAdd && (
        <p className="text-sm text-gray-400 py-6 text-center">
          まだツールが登録されていません
        </p>
      )}

      {orderedCats.map((cat) => {
        const label = TOOL_CATEGORY_LABELS[cat as keyof typeof TOOL_CATEGORY_LABELS] ?? cat;
        const items = grouped.get(cat)!;
        return (
          <div key={cat} className="mb-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              {label}
            </p>
            <div className="space-y-1.5">
              {items.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <span className="text-sm font-medium text-gray-800 flex-1">{row.name}</span>

                  {/* note 表示 / 編集 */}
                  {editingId === row.id ? (
                    <>
                      <input
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        placeholder="補足テキスト（任意）"
                        className="border border-gray-300 rounded px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSaveNote(row)}
                        className={`${btnSm} bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50`}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className={`${btnSm} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      {row.note && (
                        <span className="text-xs text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5">
                          {row.note}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditingId(row.id); setEditingNote(row.note ?? ""); }}
                        className={`${btnSm} border border-gray-300 text-gray-600 hover:bg-gray-50`}
                      >
                        {row.note ? "補足を編集" : "補足を追加"}
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRemove(row)}
                    className={`${btnSm} text-red-600 hover:bg-red-50 border border-red-200 disabled:opacity-40`}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ── 追加パネル ──────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="mt-4 border border-blue-200 rounded-lg bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-blue-800">ツールを検索して追加</p>
            <button
              type="button"
              onClick={() => { setShowAdd(false); setShowNewForm(false); setSearchQ(""); setNewError(""); }}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>

          {/* 検索入力 */}
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="名前・略称・別名で検索（例: セールスフォース / GCP / k8s）"
            className={inputCls}
            autoFocus
          />

          {/* 検索結果 */}
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white divide-y divide-gray-100">
            {searchResults.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-3">該当なし</p>
            ) : (
              searchResults.slice(0, 30).map(({ master, aliasHit }) => {
                const already = addedIds.has(master.id);
                const catLabel = TOOL_CATEGORY_LABELS[master.category as keyof typeof TOOL_CATEGORY_LABELS] ?? master.category;
                return (
                  <button
                    key={master.id}
                    type="button"
                    disabled={already || isPending}
                    onClick={() => handleSelect(master)}
                    className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors ${
                      already
                        ? "text-gray-300 cursor-default bg-gray-50"
                        : "hover:bg-blue-50 text-gray-800"
                    }`}
                  >
                    <span className="flex-1">
                      <span className="font-medium">{master.name}</span>
                      <span className="text-xs text-gray-400 ml-1.5">（{catLabel}）</span>
                      {aliasHit && (
                        <span className="text-xs text-blue-600 ml-1.5">
                          … 「{aliasHit}」にヒット
                        </span>
                      )}
                    </span>
                    {already && (
                      <span className="text-xs text-gray-300 shrink-0">追加済み</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* 一覧に無い場合 */}
          <div className="mt-3 border-t border-blue-200 pt-3">
            {!showNewForm ? (
              <button
                type="button"
                onClick={() => { setShowNewForm(true); setNewName(searchQ); setNewError(""); }}
                className="text-sm text-blue-700 hover:text-blue-900 underline"
              >
                一覧に無い場合はマスタに新規追加 →
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-700">マスタに新規追加</p>

                {/* 重複警告 */}
                {dupWarning && (
                  <div className="bg-amber-50 border border-amber-300 rounded px-3 py-2 text-xs text-amber-800">
                    ⚠ 「{dupWarning.name}」として既に登録されています。
                    上の検索欄で選択してください。
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      ツール名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => { setNewName(e.target.value); setNewError(""); }}
                      placeholder="Salesforce"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      カテゴリ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className={inputCls}
                      aria-label="カテゴリ"
                    >
                      {TOOL_CATEGORY_ORDER.map((slug) => (
                        <option key={slug} value={slug}>
                          {TOOL_CATEGORY_LABELS[slug as keyof typeof TOOL_CATEGORY_LABELS]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    別名・略称（カンマ区切りで複数入力）
                  </label>
                  <input
                    value={newAliases}
                    onChange={(e) => setNewAliases(e.target.value)}
                    placeholder="SFDC, セールスフォース, Sales Cloud"
                    className={inputCls}
                  />
                  <p className="text-xs text-gray-400 mt-0.5">
                    表記ゆれを吸収します。次回から別名でも検索できるようになります。
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    補足（任意）
                  </label>
                  <input
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="営業部門のみ利用"
                    className={inputCls}
                  />
                </div>

                {newError && (
                  <p className="text-xs text-red-600">{newError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPending || !!dupWarning}
                    onClick={handleCreateMaster}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isPending ? "追加中..." : "マスタに追加して選択"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(false); setNewName(""); setNewError(""); }}
                    className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-20 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm text-white transition-opacity ${
            toast.ok ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </section>
  );
}
