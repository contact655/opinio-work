"use client";

import { useState, useTransition } from "react";
import { generateProposals, deleteProposal, deleteProposalsForCandidate, type ActionResult } from "./actions";

type Candidate = { id: string; name: string; isTest: boolean };
type Row = {
  id: string; candidateName: string; companyName: string;
  evidenceCount: number; counterCount: number; hasJob: boolean; computedAt: string;
  candidateResponse: string | null; companyResponse: string | null;
};

export default function ProposalsAdminClient({
  candidates, rows, minEvidence,
}: { candidates: Candidate[]; rows: Row[]; minEvidence: number }) {
  const [sel, setSel] = useState("");
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  /* ⚠️ 結果は必ず画面に出す。**「エラーが出なかった」を成功にしない**ので、
        作れた数だけでなく「根拠2件未満で落ちた数」も出す。 */
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => setMsg(await fn()));

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>提案を作る（運営）</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.7 }}>
        候補者を1人選ぶと、掲載中の企業ぶんの提案を作ります。根拠が {minEvidence} 件以上そろった
        組み合わせだけが行になります。<br />
        根拠は<strong>作った時点のスナップショット</strong>で、表示のたびに作り直しません。
        すでにある提案は上書きしません（作り直すには先に消してください）。
      </p>
      {/* ★★「一度きり」は意図した仕様。ここに書いておかないと、
             運営が「なぜこの会社が出てこないのか」を追えない（2026-09-21）。 */}
      <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20, lineHeight: 1.7, background: "#F5F7FD", border: "1px solid #DCE3F5", borderRadius: 8, padding: "10px 12px" }}>
        <strong>提案は「候補者 × 企業 × 求人」につき一度きりです。</strong>
        一度出した組み合わせは、見送られても<strong>もう提案に出てきません</strong>
        （見送り理由を④の材料として残すため、作り直しでは上書きしない設計）。<br />
        もう一度出したいときは、下の表でその1件を消してから作り直してください。
        <strong>期間や理由による自動の再提案は、まだ作っていません。</strong>
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <select
          value={sel}
          onChange={(e) => setSel(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", minWidth: 260 }}
        >
          <option value="">候補者を選ぶ…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.isTest ? "（検証用アカウント）" : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => run(() => generateProposals(sel))}
          disabled={!sel || pending}
          style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "var(--royal)", color: "#fff", fontWeight: 600, cursor: sel && !pending ? "pointer" : "default", opacity: sel && !pending ? 1 : 0.5 }}
        >
          {pending ? "作成中…" : "提案を作る"}
        </button>
        <button
          onClick={() => {
            if (!confirm("この候補者の提案をすべて消します。返答済みの提案と見送り理由も一緒に消えます。よろしいですか？")) return;
            run(() => deleteProposalsForCandidate(sel));
          }}
          disabled={!sel || pending}
          style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--line)", background: "#fff", cursor: sel && !pending ? "pointer" : "default", opacity: sel && !pending ? 1 : 0.5 }}
        >
          この候補者の提案を消す
        </button>
      </div>

      {msg && (
        <div
          role="status"
          style={{
            padding: "12px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13, lineHeight: 1.8,
            background: msg.ok ? "#F1F6F1" : "#FDF2F2",
            border: `1px solid ${msg.ok ? "#CFE3CF" : "#F0C7C7"}`,
          }}
        >
          {msg.ok && msg.kind === "delete" ? (
            /* ★削除は削除として書く。「作成しました」と出さない（2026-09-21） */
            <>
              <strong>{msg.deleted} 件消しました。</strong><br />
              返答と見送り理由も一緒に消えています。この組み合わせは、次に「提案を作る」を
              押したときにまた出てくるようになりました。
            </>
          ) : msg.ok ? (
            <>
              <strong>作成しました。</strong><br />
              突き合わせた企業 {msg.result.examined} 社 ／ 根拠{minEvidence}件以上 {msg.result.proposable} 社 ／
              <strong> 新しく作った {msg.result.created} 件</strong>
              {msg.result.skipped > 0 && <>（すでにあった {msg.result.skipped} 件はそのまま）</>}
              <br />
              {/* ★黙って消さない。落ちた数を必ず出す */}
              根拠が{minEvidence}件に満たず提案にしなかった企業: <strong>{msg.result.belowThreshold} 社</strong>
            </>
          ) : (
            <><strong>失敗しました。</strong><br />{msg.error}</>
          )}
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>作成済みの提案（{rows.length}件）</h2>
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          まだありません。上で候補者を選んで作成してください。
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
              <th style={{ padding: 8 }}>候補者</th><th style={{ padding: 8 }}>企業</th>
              <th style={{ padding: 8 }}>根拠</th><th style={{ padding: 8 }}>反証</th>
              <th style={{ padding: 8 }}>求人</th><th style={{ padding: 8 }}>作成日</th>
              <th style={{ padding: 8 }}>求職者</th><th style={{ padding: 8 }}>企業</th>
              <th style={{ padding: 8 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={{ padding: 8 }}>{r.candidateName}</td>
                <td style={{ padding: 8 }}>{r.companyName}</td>
                <td style={{ padding: 8 }}>{r.evidenceCount}</td>
                <td style={{ padding: 8 }}>{r.counterCount}</td>
                <td style={{ padding: 8 }}>{r.hasJob ? "あり" : "—"}</td>
                <td style={{ padding: 8 }}>{r.computedAt}</td>
                {/* ⚠️ null は「まだ答えていない」。「見送り」と読ませない */}
                <td style={{ padding: 8 }}>{r.candidateResponse ?? "未回答"}</td>
                <td style={{ padding: 8 }}>{r.companyResponse ?? "未回答"}</td>
                {/* ★この1件だけ消す（2026-09-21）。
                       ⚠️ 見送り理由も一緒に消えるので、必ず警告してから。 */}
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => {
                      if (!confirm(`「${r.candidateName} × ${r.companyName}」の提案を1件消します。\n返答と見送り理由も一緒に消えます。もう一度提案に出せるようになります。\nよろしいですか？`)) return;
                      run(() => deleteProposal(r.id));
                    }}
                    disabled={pending}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "#fff", fontSize: 12, cursor: pending ? "default" : "pointer", opacity: pending ? 0.5 : 1 }}
                  >
                    消す
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
