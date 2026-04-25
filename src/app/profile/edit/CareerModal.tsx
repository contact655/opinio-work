"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MOCK_COMPANIES } from "@/app/companies/mockCompanies";
import {
  searchRoles,
  getRoleLabelById,
} from "./roleData";
import type { Experience, CompanyType } from "./mockProfileData";

// ─── Types ────────────────────────────────────────────────────────────────────

type CareerFormState = {
  companyType: CompanyType;
  companyId: string;
  companyText: string;
  companyAnonymized: string;
  roleCategoryId: string;
  roleTitle: string;
  startedAt: string;
  endedAt: string;
  isCurrent: boolean;
  description: string;
};

type Props = {
  open: boolean;
  editTarget: Experience | null;
  onClose: () => void;
  onSave: (exp: Experience) => void;
};

const EMPTY_FORM: CareerFormState = {
  companyType: "master",
  companyId: "",
  companyText: "",
  companyAnonymized: "",
  roleCategoryId: "",
  roleTitle: "",
  startedAt: "",
  endedAt: "",
  isCurrent: false,
  description: "",
};

// ─── Sub: Company type radio ──────────────────────────────────────────────────

function CompanyTypeOption({
  type: _type, label, desc, active, onClick,
}: {
  type: CompanyType; label: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px",
        background: active ? "var(--royal-50)" : "#fff",
        border: `1.5px solid ${active ? "var(--royal)" : "var(--line)"}`,
        borderRadius: 10,
        display: "flex", gap: 12, alignItems: "flex-start",
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
        border: `2px solid ${active ? "var(--royal)" : "var(--line)"}`,
        position: "relative",
      }}>
        {active && (
          <div style={{
            position: "absolute", top: 3, left: 3,
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--royal)",
          }} />
        )}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

// ─── Sub: Company master suggest ──────────────────────────────────────────────

function CompanyMasterSearch({
  value, onChange,
}: {
  value: string; onChange: (id: string, name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const results = MOCK_COMPANIES.filter(
    (c) =>
      query.length > 0 &&
      (c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.name.includes(query))
  ).slice(0, 6);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    if (value) {
      const c = MOCK_COMPANIES.find((c) => c.id === value);
      if (c) setDisplayName(c.name);
    } else {
      setDisplayName("");
      setQuery("");
    }
  }, [value]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "var(--ink-mute)", pointerEvents: "none",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          value={displayName || query}
          onChange={(e) => { setQuery(e.target.value); setDisplayName(""); onChange("", ""); setOpen(true); }}
          onFocus={() => { if (!displayName) setOpen(true); }}
          placeholder="企業名を入力..."
          style={{
            width: "100%", padding: "10px 12px 10px 36px",
            border: "1.5px solid var(--line)", borderRadius: 8,
            fontSize: 13, color: "var(--ink)", background: "#fff",
            outline: "none",
          }}
        />
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(15,23,42,0.1)", zIndex: 20,
          maxHeight: 280, overflowY: "auto",
        }}>
          {results.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                onChange(c.id, c.name);
                setDisplayName(c.name);
                setQuery("");
                setOpen(false);
              }}
              style={{
                padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                cursor: "pointer", borderBottom: "1px solid var(--line-soft)",
              }}
              className="company-suggest-row"
            >
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: c.gradient,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0, fontFamily: "Inter, sans-serif",
              }}>
                {c.name.charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-mute)", marginTop: 1 }}>
                  {c.industry} · {c.employee_count}名
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub: Role suggest ────────────────────────────────────────────────────────

function RoleSuggest({
  value, onChange,
}: {
  value: string; onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState(value ? getRoleLabelById(value) : "");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = searchRoles(query);

  useEffect(() => {
    setQuery(value ? getRoleLabelById(value) : "");
  }, [value]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <span style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "var(--ink-mute)", pointerEvents: "none",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(""); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="職種名で検索... 例：営業、PdM"
          style={{
            width: "100%", padding: "10px 12px 10px 36px",
            border: "1.5px solid var(--line)", borderRadius: 8,
            fontSize: 13, color: "var(--ink)", background: "#fff", outline: "none",
          }}
        />
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid var(--line)", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(15,23,42,0.1)", zIndex: 20,
          maxHeight: 320, overflowY: "auto",
        }}>
          {results.map((cat) => (
            <div key={cat.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
              <div style={{
                padding: "8px 14px 4px",
                fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
                letterSpacing: "0.1em", textTransform: "uppercase",
                fontFamily: "Inter, sans-serif",
              }}>
                {cat.label}
              </div>
              {cat.children.map((child) => (
                <div
                  key={child.id}
                  onClick={() => {
                    onChange(child.id);
                    setQuery(child.label);
                    setOpen(false);
                  }}
                  style={{
                    padding: "8px 14px",
                    fontSize: 12, color: value === child.id ? "var(--royal)" : "var(--ink)",
                    background: value === child.id ? "var(--royal-50)" : "transparent",
                    fontWeight: value === child.id ? 600 : 400,
                    cursor: "pointer", display: "flex", justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  className="role-suggest-row"
                >
                  {child.label}
                  {value === child.id && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          ))}
          <div style={{
            padding: "10px 14px", background: "var(--bg-tint)",
            fontSize: 11, color: "var(--ink-soft)", display: "flex", alignItems: "center", gap: 6,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            マスタにない職種は運営に追加依頼できます
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function CareerModal({ open, editTarget, onClose, onSave }: Props) {
  const [form, setForm] = useState<CareerFormState>(EMPTY_FORM);

  useEffect(() => {
    if (open) {
      if (editTarget) {
        setForm({
          companyType: editTarget.companyType,
          companyId: editTarget.companyId ?? "",
          companyText: editTarget.companyText ?? "",
          companyAnonymized: editTarget.companyAnonymized ?? "",
          roleCategoryId: editTarget.roleCategoryId,
          roleTitle: editTarget.roleTitle ?? "",
          startedAt: editTarget.startedAt,
          endedAt: editTarget.endedAt ?? "",
          isCurrent: editTarget.isCurrent,
          description: editTarget.description ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editTarget]);

  const set = useCallback(<K extends keyof CareerFormState>(k: K, v: CareerFormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const handleSave = () => {
    let displayCompanyName = "";
    if (form.companyType === "master") {
      const c = MOCK_COMPANIES.find((c) => c.id === form.companyId);
      displayCompanyName = c?.name ?? form.companyId;
    } else if (form.companyType === "custom") {
      displayCompanyName = form.companyText;
    } else {
      displayCompanyName = form.companyAnonymized;
    }

    const exp: Experience = {
      id: editTarget?.id ?? `exp-${Date.now()}`,
      companyType: form.companyType,
      companyId: form.companyType === "master" ? form.companyId : undefined,
      companyText: form.companyType === "custom" ? form.companyText : undefined,
      companyAnonymized: form.companyType === "anon" ? form.companyAnonymized : undefined,
      displayCompanyName,
      roleCategoryId: form.roleCategoryId,
      roleTitle: form.roleTitle || undefined,
      startedAt: form.startedAt,
      endedAt: form.isCurrent ? undefined : (form.endedAt || undefined),
      isCurrent: form.isCurrent,
      description: form.description || undefined,
    };
    onSave(exp);
  };

  const canSave = (() => {
    if (!form.roleCategoryId || !form.startedAt) return false;
    if (form.companyType === "master" && !form.companyId) return false;
    if (form.companyType === "custom" && !form.companyText.trim()) return false;
    if (form.companyType === "anon" && !form.companyAnonymized.trim()) return false;
    return true;
  })();

  if (!open) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)",
        backdropFilter: "blur(4px)", zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, maxWidth: 560, width: "100%",
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(15,23,42,0.2)",
      }}>
        {/* Head */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{
            fontFamily: '"Noto Serif JP", serif',
            fontWeight: 600, fontSize: 18, color: "var(--ink)",
          }}>
            {editTarget ? "職歴を編集" : "職歴を追加"}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, border: "none", background: "none",
              borderRadius: 6, cursor: "pointer", color: "var(--ink-mute)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>

          {/* Company type */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              会社名をどうやって登録しますか？
              <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <CompanyTypeOption
                type="master" active={form.companyType === "master"}
                label="Opinioに登録されている企業から選ぶ"
                desc="マスタに登録された企業。プロフィール上で企業詳細へのリンクになります。"
                onClick={() => set("companyType", "master")}
              />
              <CompanyTypeOption
                type="custom" active={form.companyType === "custom"}
                label="登録されていない企業を自由入力"
                desc="Opinioマスタにない企業を入力。テキスト表示、「未登録企業」タグ付き。"
                onClick={() => set("companyType", "custom")}
              />
              <CompanyTypeOption
                type="anon" active={form.companyType === "anon"}
                label="会社名を公開しない（匿名表示）"
                desc='表示名を自由に入力。例：「AIスタートアップA社」「大手SaaS企業」など。リンクなし。'
                onClick={() => set("companyType", "anon")}
              />
            </div>
          </div>

          {/* Company input — master */}
          {form.companyType === "master" && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                企業を検索 <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>
              </div>
              <CompanyMasterSearch
                value={form.companyId}
                onChange={(id, _name) => { set("companyId", id); }}
              />
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.6 }}>
                マスタにない企業は「登録されていない企業を自由入力」を選んでください。
              </div>
            </div>
          )}

          {/* Company input — custom */}
          {form.companyType === "custom" && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                会社名 <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>
              </div>
              <input
                type="text"
                value={form.companyText}
                onChange={(e) => set("companyText", e.target.value)}
                placeholder="例：株式会社〇〇"
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid var(--line)", borderRadius: 8,
                  fontSize: 13, color: "var(--ink)", outline: "none",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.6 }}>
                プロフィール上で「未登録企業」タグと共に表示されます。
              </div>
            </div>
          )}

          {/* Company input — anon */}
          {form.companyType === "anon" && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                表示する会社名 <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>
              </div>
              <input
                type="text"
                value={form.companyAnonymized}
                onChange={(e) => set("companyAnonymized", e.target.value)}
                placeholder='例：AIスタートアップA社'
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid var(--line)", borderRadius: 8,
                  fontSize: 13, color: "var(--ink)", outline: "none",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.6 }}>
                実際の会社名ではなく、表示用の名前を入力してください。「非公開」タグと共に表示されます。
              </div>
            </div>
          )}

          {/* Role category */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              職種カテゴリ <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>
            </div>
            <RoleSuggest
              value={form.roleCategoryId}
              onChange={(id) => set("roleCategoryId", id)}
            />
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>
              Opinioの職種マスタから選択します。データ集計やレコメンドに使われます。
            </div>
          </div>

          {/* Role title */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              具体的な役職・肩書き
              <span style={{ color: "var(--ink-mute)", fontSize: 10, fontWeight: 400, marginLeft: 6 }}>任意</span>
            </div>
            <input
              type="text"
              value={form.roleTitle}
              onChange={(e) => set("roleTitle", e.target.value)}
              placeholder="例：エンタープライズセールス マネージャー"
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontSize: 13, color: "var(--ink)", outline: "none",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>
              職種カテゴリより詳しく書けます。プロフィール上に表示されます。
            </div>
          </div>

          {/* Period */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
                入社年月 <span style={{ color: "var(--error)", fontSize: 11 }}>必須</span>
              </div>
              <input
                type="month"
                value={form.startedAt}
                onChange={(e) => set("startedAt", e.target.value)}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid var(--line)", borderRadius: 8,
                  fontSize: 13, color: "var(--ink)", outline: "none", background: "#fff",
                }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>退職年月</div>
              <input
                type="month"
                value={form.endedAt}
                onChange={(e) => set("endedAt", e.target.value)}
                disabled={form.isCurrent}
                style={{
                  width: "100%", padding: "10px 12px",
                  border: "1.5px solid var(--line)", borderRadius: 8,
                  fontSize: 13, color: "var(--ink)", outline: "none", background: "#fff",
                  opacity: form.isCurrent ? 0.4 : 1,
                }}
              />
              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>
                在籍中の場合は空欄
              </div>
            </div>
          </div>

          {/* is_current */}
          <div style={{ marginBottom: 20 }}>
            <label style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, color: "var(--ink)", cursor: "pointer",
            }}>
              <input
                type="checkbox"
                checked={form.isCurrent}
                onChange={(e) => set("isCurrent", e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--royal)", cursor: "pointer" }}
              />
              現在もこの会社で働いている（現職として登録）
            </label>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, paddingLeft: 24 }}>
              副業・パラレルキャリアの場合、複数の現職を登録できます。
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              この経験の説明
              <span style={{ color: "var(--ink-mute)", fontSize: 10, fontWeight: 400, marginLeft: 6 }}>任意</span>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              placeholder="どんな仕事をしていたか、何を得たか、などを自由に記述してください。"
              style={{
                width: "100%", padding: "10px 12px",
                border: "1.5px solid var(--line)", borderRadius: 8,
                fontSize: 13, color: "var(--ink)", resize: "vertical",
                minHeight: 100, lineHeight: 1.8, outline: "none", fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 24px", borderTop: "1px solid var(--line)",
          display: "flex", gap: 8, justifyContent: "flex-end",
          background: "var(--bg-tint)",
        }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              border: "1px solid var(--line)", borderRadius: 8,
              background: "#fff", color: "var(--ink)", cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: "8px 18px", fontSize: 13, fontWeight: 600,
              border: "none", borderRadius: 8, cursor: canSave ? "pointer" : "not-allowed",
              background: canSave ? "var(--royal)" : "var(--line)",
              color: canSave ? "#fff" : "var(--ink-mute)",
              transition: "all 0.15s",
            }}
          >
            {editTarget ? "変更を保存" : "追加する"}
          </button>
        </div>
      </div>

      <style>{`
        .company-suggest-row:hover { background: var(--royal-50) !important; }
        .role-suggest-row:hover { background: var(--royal-50) !important; color: var(--royal) !important; }
      `}</style>
    </div>
  );
}
