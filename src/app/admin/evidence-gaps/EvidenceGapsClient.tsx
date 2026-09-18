import type { EvidenceGapsResult } from "@/lib/admin/evidenceGaps";

/**
 * ⚠️ サーバーコンポーネントのまま（"use client" を付けない）。
 *    操作が無く、出すのは数字と文だけ。クライアントに送る意味が無い
 *    ——送ると氏名とメールアドレスがそのぶんペイロードに載る。
 */

const TD: React.CSSProperties = { padding: "8px 10px", fontSize: 13, verticalAlign: "top" };
const TH: React.CSSProperties = { ...TD, fontWeight: 700, whiteSpace: "nowrap" };

/** 「2 / 3」。★足りているかで色を変える（数字だけだと読み取りに時間がかかる） */
function Count({ n, need, sub }: { n: number; need: number; sub?: string }) {
  const ok = n >= need;
  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <strong style={{ fontSize: 14, color: ok ? "#1E7A4B" : "var(--ink)" }}>{n}</strong>
      <span style={{ color: "var(--ink-mute)", fontSize: 12 }}> / {need}</span>
      {sub && <span style={{ color: "var(--ink-mute)", fontSize: 11, display: "block" }}>{sub}</span>}
    </span>
  );
}

export default function EvidenceGapsClient({ data }: { data: EvidenceGapsResult | null }) {
  if (!data) {
    return (
      <div style={{ padding: 32, maxWidth: 900 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 10px" }}>根拠の棚卸し</h1>
        <p style={{ fontSize: 14, color: "#B3261E", lineHeight: 1.9 }}>
          集計に失敗しました。<strong>「0社」という意味ではありません。</strong>
          しばらくしてから開き直してください。
        </p>
      </div>
    );
  }

  const { companies, unanswered, targets, computedAt } = data;
  const standingNow = companies.filter((c) => c.standing >= targets.proposal).length;
  const oneAway = companies.filter((c) => c.standing === targets.proposal - 1).length;

  return (
    <div style={{ padding: 32, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>根拠の棚卸し</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.9, margin: "0 0 4px" }}>
        ②（求職者への提案）と ⑨（企業への候補者提案）は、<strong>根拠が {targets.proposal} 本
        そろった組み合わせだけ</strong>を出します。ここは「あと何をすれば立つか」の一覧です。
      </p>
      {/* ★数字には必ず計測日時を添える（日付の無い数字は翌日には嘘になる） */}
      <p style={{ fontSize: 11, color: "var(--ink-mute)", margin: "0 0 18px" }}>
        {new Date(computedAt).toLocaleString("ja-JP")} 時点。開くたびに数え直します
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 22 }}>
        {[
          { label: `根拠が${targets.proposal}本立っている`, v: standingNow },
          { label: "あと1本で立つ", v: oneAway },
          { label: "掲載企業", v: companies.length },
          { label: "決め手が未回答の人", v: unanswered.length },
        ].map((s) => (
          <div key={s.label} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 16px", minWidth: 150 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── ★在籍/出身の違いを先に説明する（声をかける相手が変わる）───────── */}
      <div style={{ background: "var(--royal-50)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", marginBottom: 18, fontSize: 12, lineHeight: 1.9 }}>
        <strong>経路と決め手は、在籍者でなくても積み上がります。</strong>
        その会社を辞めた人（出身者）の職歴でも増えるので、
        <strong>いま在籍している人に限らず声をかけられます。</strong><br />
        一方 <strong>「話せる人」は在籍中であることが要ります</strong>
        （面談対応者の同意 ＋ 在籍中の職歴）。だから列を分けてあります。<br />
        <span style={{ color: "var(--ink-mute)" }}>
          経路 = その会社へ移ってきた人の数（職歴の隣接から算出）／
          決め手 = その会社の職歴で入社理由が答えられている件数
        </span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 34 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
            <th style={TH}>企業</th>
            <th style={TH}>経路<span style={{ fontWeight: 400, color: "var(--ink-mute)" }}>（在籍/出身）</span></th>
            <th style={TH}>決め手<span style={{ fontWeight: 400, color: "var(--ink-mute)" }}>（在籍/出身）</span></th>
            <th style={TH}>話せる人</th>
            <th style={TH}>公開求人</th>
            <th style={TH}>あと何が足りないか</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => {
            const standing = c.standing >= targets.proposal;
            return (
              <tr key={c.companyId} style={{ borderBottom: "1px solid var(--line)", background: standing ? "#F3FAF5" : undefined }}>
                <td style={{ ...TD, fontWeight: 600 }}>{c.companyName}</td>
                <td style={TD}><Count n={c.pathCurrent + c.pathAlumni} need={targets.path} sub={`${c.pathCurrent} / ${c.pathAlumni}`} /></td>
                <td style={TD}><Count n={c.motiveCurrent + c.motiveAlumni} need={targets.motive} sub={`${c.motiveCurrent} / ${c.motiveAlumni}`} /></td>
                <td style={TD}><Count n={c.talkable} need={targets.talkable} /></td>
                <td style={{ ...TD, color: c.openJobs > 0 ? undefined : "var(--ink-mute)" }}>{c.openJobs}</td>
                <td style={{ ...TD, fontSize: 12, lineHeight: 1.7 }}>
                  {standing
                    ? <span style={{ color: "#1E7A4B", fontWeight: 700 }}>根拠が{c.standing}本立っています</span>
                    : <span>{c.gapLine ?? "—"}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── 未回答者 ──────────────────────────────────────────────────────── */}
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 6px" }}>決め手が未回答の人（{unanswered.length}名）</h2>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.9, margin: "0 0 4px" }}>
        職歴はあるが、入社の決め手をまだ1件も答えていない人。
        入力は <strong>/mypage の職歴</strong>（カードのアイコン、または「N件の職歴が未回答です」）から。
      </p>
      {/* ★最終ログインを必ず見る。設問が出たのは 2026-09-12 */}
      <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.9, margin: "0 0 14px" }}>
        ⚠️ <strong>最終ログインを先に見ること。</strong>設問が画面に出たのは <strong>2026-09-12</strong> で、
        それより前が最終ログインの人は<strong>まだ一度も見ていません</strong>（答えていないのではなく、
        届いていない）。
      </p>
      {unanswered.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>該当なし。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)" }}>
              <th style={TH}>名前</th><th style={TH}>連絡先</th><th style={TH}>職歴</th>
              <th style={TH}>最終ログイン</th><th style={TH}>対象企業（掲載中）</th>
            </tr>
          </thead>
          <tbody>
            {unanswered.map((p) => {
              const seen = p.lastSignInAt ? p.lastSignInAt.slice(0, 10) >= "2026-09-12" : false;
              return (
                <tr key={p.userId} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ ...TD, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...TD, fontSize: 12 }}>{p.email ?? "—"}</td>
                  <td style={TD}>{p.experiences}</td>
                  <td style={TD}>
                    {p.lastSignInAt ? p.lastSignInAt.slice(0, 10) : "—"}
                    <span style={{ display: "block", fontSize: 11, color: seen ? "var(--ink-mute)" : "#8A6D3B" }}>
                      {seen ? "設問を見ている" : "設問を見ていない"}
                    </span>
                  </td>
                  {/* ⚠️ 掲載中の企業だけ名前が出る。自由入力・非掲載は名前を持たない */}
                  <td style={{ ...TD, fontSize: 12 }}>{p.companies.length ? p.companies.join("・") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.9, marginTop: 20 }}>
        ⚠️ 依頼メールの送信はここでは作っていません。勧誘にあたるため、配信停止の列と
        セットで別途設計が要ります。対象が少ないうちは手で連絡するほうが早く、
        反応を見てから文面を決められます。
      </p>
    </div>
  );
}
