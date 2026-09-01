"use client";

import { useState, useTransition } from "react";
import { createPlacement, updatePlacement, deletePlacement } from "./actions";

type Placement = {
  id: string;
  candidate_id: string;
  company_id: string;
  job_id: string | null;
  joined_at: string;
  channel: string;
  annual_salary: number | null;
  fee_amount: number | null;
  resigned_at: string | null;
  resignation_reason: string | null;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  daysLeft: number | null;
};

type User = { id: string; name: string };
type Company = { id: string; name: string };
type Job = { id: string; title: string; companyId: string };

type Props = {
  placements: Placement[];
  users: User[];
  companies: Company[];
  jobs: Job[];
};

const CHANNEL_LABELS: Record<string, string> = {
  platform: "プラットフォーム（15%）",
  agent: "エージェント（30〜35%）",
};
const RESIGNATION_LABELS: Record<string, string> = {
  voluntary: "自己都合",
  company: "会社都合",
  other: "その他",
};

const EMPTY_FORM = {
  candidate_id: "",
  company_id: "",
  job_id: "",
  joined_at: "",
  channel: "platform",
  annual_salary: "",
  fee_amount: "",
  resigned_at: "",
  resignation_reason: "",
};

export default function PlacementsClient({ placements: initial, users, companies, jobs }: Props) {
  const [placements] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Placement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(p: Placement) {
    setEditing(p);
    setForm({
      candidate_id: p.candidate_id,
      company_id: p.company_id,
      job_id: p.job_id ?? "",
      joined_at: p.joined_at,
      channel: p.channel,
      annual_salary: p.annual_salary?.toString() ?? "",
      fee_amount: p.fee_amount?.toString() ?? "",
      resigned_at: p.resigned_at ?? "",
      resignation_reason: p.resignation_reason ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });

    startTransition(async () => {
      if (editing) {
        const res = await updatePlacement(editing.id, fd);
        if (res.error) { setError(res.error); return; }
      } else {
        const res = await createPlacement(fd);
        if (res.error) { setError(res.error); return; }
      }
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("この就職実績を削除しますか？")) return;
    startTransition(async () => {
      await deletePlacement(id);
      window.location.reload();
    });
  }

  const filteredJobs = form.company_id ? jobs.filter(j => j.companyId === form.company_id) : jobs;

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>就職実績管理</h1>
          <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            登録した候補者は就職日から2年間、スカウト送信不可となります。
          </p>
        </div>
        <button onClick={openNew} style={{
          background: "var(--royal)", color: "#fff",
          border: "none", borderRadius: 8, padding: "10px 20px",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>
          + 就職実績を登録
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: "#fff", borderRadius: 14, padding: "32px 36px",
            width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
              {editing ? "就職実績を編集" : "就職実績を登録"}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 候補者 */}
              <label style={LABEL_STYLE}>
                候補者 <span style={{ color: "var(--error)" }}>*</span>
                <select required value={form.candidate_id} onChange={e => setForm(f => ({ ...f, candidate_id: e.target.value }))} style={SELECT_STYLE}>
                  <option value="">選択してください</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>

              {/* 企業 */}
              <label style={LABEL_STYLE}>
                企業 <span style={{ color: "var(--error)" }}>*</span>
                <select required value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value, job_id: "" }))} style={SELECT_STYLE}>
                  <option value="">選択してください</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>

              {/* 求人 */}
              <label style={LABEL_STYLE}>
                求人（任意）
                <select value={form.job_id} onChange={e => setForm(f => ({ ...f, job_id: e.target.value }))} style={SELECT_STYLE}>
                  <option value="">未設定</option>
                  {filteredJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
                </select>
              </label>

              {/* 入社日 */}
              <label style={LABEL_STYLE}>
                入社日 <span style={{ color: "var(--error)" }}>*</span>
                <input required type="date" value={form.joined_at} onChange={e => setForm(f => ({ ...f, joined_at: e.target.value }))} style={INPUT_STYLE} />
              </label>

              {/* 経路 */}
              <label style={LABEL_STYLE}>
                経路 <span style={{ color: "var(--error)" }}>*</span>
                <select required value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={SELECT_STYLE}>
                  <option value="platform">プラットフォーム（成果報酬15%）</option>
                  <option value="agent">エージェント（成果報酬30〜35%）</option>
                </select>
              </label>

              {/*
                理論年収（ow_placements.annual_salary）
                ⚠️ 定義: 税込（額面）・円・単一値。成果報酬の算定基準になるので曖昧にしない。
                   手取りではない。賞与・インセンティブを含む想定年収を入れる。
                ⚠️ ow_job_applications.hired_salary に同じ概念の列があるが、
                   正はこちら（ow_placements）。hired_salary は応募を経由した入社しか
                   記録できず、直接紹介の入社を取りこぼすため。hired_salary は削除して
                   いないので、集計するときに二重計上しないこと。
              */}
              <label style={LABEL_STYLE}>
                理論年収（税込・円）
                <input type="number" min={0} value={form.annual_salary} onChange={e => setForm(f => ({ ...f, annual_salary: e.target.value }))} style={INPUT_STYLE} placeholder="例: 6000000" />
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400 }}>
                  額面（手取りではない）。賞与・インセンティブ込みの想定年収。
                </span>
              </label>

              {/*
                手数料額（ow_placements.fee_amount）
                ⚠️ 自動計算しない。料率は経路や個別契約で変わりうるので手入力のままにする。
              */}
              <label style={LABEL_STYLE}>
                手数料額（消費税別・円）
                <input type="number" min={0} value={form.fee_amount} onChange={e => setForm(f => ({ ...f, fee_amount: e.target.value }))} style={INPUT_STYLE} placeholder="例: 900000" />
                <span style={{ fontSize: 11, color: "var(--ink-mute)", fontWeight: 400 }}>
                  自動計算しません。経路の料率（15% / 30〜35%）を見て手入力してください。
                </span>
              </label>

              {/* 退職日 */}
              <label style={LABEL_STYLE}>
                退職日
                <input type="date" value={form.resigned_at} onChange={e => setForm(f => ({ ...f, resigned_at: e.target.value }))} style={INPUT_STYLE} />
              </label>

              {/* 退職事由 */}
              {form.resigned_at && (
                <label style={LABEL_STYLE}>
                  退職事由
                  <select value={form.resignation_reason} onChange={e => setForm(f => ({ ...f, resignation_reason: e.target.value }))} style={SELECT_STYLE}>
                    <option value="">未設定</option>
                    <option value="voluntary">自己都合</option>
                    <option value="company">会社都合</option>
                    <option value="other">その他</option>
                  </select>
                </label>
              )}

              {error && (
                <p style={{ fontSize: 13, color: "var(--error-ink)", background: "var(--error-soft)", padding: "10px 14px", borderRadius: 8 }}>
                  {error}
                </p>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 8 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 20px", fontSize: 14, cursor: "pointer" }}>
                  キャンセル
                </button>
                <button type="submit" disabled={isPending} style={{ background: "var(--royal)", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
                  {isPending ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, border: "1px solid var(--line)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "var(--bg-tint)" }}>
            <tr>
              {["候補者", "企業", "求人", "入社日", "経路", "理論年収（税込）", "手数料額", "スカウト禁止残日数", "退職日", "退職事由", "操作"].map(h => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--ink)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {placements.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: "40px", textAlign: "center", color: "var(--ink-mute)" }}>
                  就職実績はまだ登録されていません
                </td>
              </tr>
            ) : placements.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                <td style={TD}>{p.candidateName}</td>
                <td style={TD}>{p.companyName}</td>
                <td style={{ ...TD, color: "var(--ink-mute)" }}>{p.jobTitle}</td>
                <td style={TD}>{p.joined_at}</td>
                <td style={TD}>{CHANNEL_LABELS[p.channel] ?? p.channel}</td>
                {/* 金額は内部データ。求職者側・企業側には出していない（参照は /admin/placements のみ） */}
                <td style={{ ...TD, fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" }}>
                  {p.annual_salary != null
                    ? `${p.annual_salary.toLocaleString("ja-JP")}円`
                    : <span style={{ color: "var(--ink-mute)" }}>—</span>}
                </td>
                <td style={{ ...TD, fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" }}>
                  {p.fee_amount != null
                    ? `${p.fee_amount.toLocaleString("ja-JP")}円`
                    : <span style={{ color: "var(--ink-mute)" }}>—</span>}
                </td>
                <td style={TD}>
                  {p.resigned_at ? (
                    <span style={{ color: "var(--ink-mute)", fontSize: 12 }}>退職済み</span>
                  ) : p.daysLeft === 0 ? (
                    <span style={{ color: "var(--success-ink)", fontWeight: 600, fontSize: 12 }}>期間終了</span>
                  ) : (
                    <span style={{
                      display: "inline-block",
                      background: (p.daysLeft ?? 0) > 180 ? "var(--error-soft)" : "var(--warm-soft)",
                      color: (p.daysLeft ?? 0) > 180 ? "var(--error)" : "#92400E",
                      fontSize: 12, fontWeight: 700,
                      padding: "3px 10px", borderRadius: 100,
                    }}>
                      あと{p.daysLeft}日
                    </span>
                  )}
                </td>
                <td style={{ ...TD, color: "var(--ink-mute)" }}>{p.resigned_at ?? "—"}</td>
                <td style={{ ...TD, color: "var(--ink-mute)" }}>{p.resignation_reason ? RESIGNATION_LABELS[p.resignation_reason] : "—"}</td>
                <td style={TD}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(p)} style={{ fontSize: 12, padding: "4px 10px", border: "1px solid var(--line)", borderRadius: 6, background: "#fff", cursor: "pointer" }}>
                      編集
                    </button>
                    <button onClick={() => handleDelete(p.id)} style={{ fontSize: 12, padding: "4px 10px", border: "1px solid var(--error)", borderRadius: 6, background: "#fff", color: "var(--error)", cursor: "pointer" }}>
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const LABEL_STYLE: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 13, fontWeight: 600, color: "var(--ink)",
};
const INPUT_STYLE: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px",
  fontSize: 14, outline: "none", width: "100%",
};
const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE, background: "#fff",
};
const TD: React.CSSProperties = {
  padding: "12px 14px", color: "var(--ink-soft)", verticalAlign: "middle",
};
