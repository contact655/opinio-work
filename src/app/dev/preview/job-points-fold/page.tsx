import { devOnly } from "../guard";
import { Variant } from "../Variant";
import { Markdown } from "@/components/common/Markdown";
import { JobBodyFold } from "@/components/jobs/JobBodyFold";

/**
 * 求人詳細の「この募集のポイント（3行）」と「仕事内容を途中で畳む」の見本（2026-11-25 / 柴さんの指示「1と2の見本を作って」）。
 *
 * ★2026-11-25 に本番の求人ページへ入れた（柴さんの了承）。決めたときの見本として残す。
 *   ① ポイント … 求人の highlight（いまは1段落の文）を、改行で区切った3行までの箇条書きとして出す案
 *   ② 畳む     … 仕事内容が長いときだけ 420px で畳み、「続きを読む」で開く（JobBodyFold）
 *
 * ⚠️ ここで DB を読まないこと。会社・本文はすべて架空。
 */

const POINTS = [
  "顧客と直接話し、要件定義から設計まで任される",
  "入社3か月でPLに上がったメンバーが複数いる",
  "受注案件の過半数がAI関連。本番運用まで経験できる",
];

const LONG_BODY = `■ このポジションについて
Salesforce の開発案件で、顧客業務の整理から要件定義・設計・実装・テスト・本番後の改善までを一気通貫で担当します。
いずれは PL・PM として、案件全体をまとめる役割を担っていただくことを想定しています。

■ 業務内容
・顧客業務の構造整理／要件定義・業務フロー設計
・Salesforce 上での実装（ノーコード・ローコード中心）
・AI エージェントを組み込んだ業務の設計
・テスト計画の作成と実施
・本番稼働後の改善提案

■ このポジションの魅力
現場と顧客の業務をつかんだうえで、設計・要件定義を任せる順番にしています。
実装から始め、段階を踏んで短期間でステップアップしたメンバーが複数います。

■ 当社で得られるもの
Salesforce での開発はプロコード中心ではなく、ノーコード・ローコードでの実装が中心です。
その分、「業務を分解する力」「顧客と要件を決める力」「全体を設計する力」が身につきます。
受注している開発案件の過半数が AI 関連で、本番運用まで持っていく経験を数多く積めます。

■ 評価・年収・働き方
・昇給／賞与は年3回。年齢や経験年数を問わず、成果と姿勢を重視します
・評価は7段階の等級制度。各等級で求められる役割と月給の水準を社内に公開しています`;

const SHORT_BODY = `■ 業務内容
・既存顧客向けの Salesforce 保守と小さな改修
・問い合わせの一次対応と、開発チームへの引き継ぎ`;

const SEC_TITLE: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "var(--space-3)", margin: "0 0 var(--space-4)",
  fontFamily: "var(--font-noto-serif)", fontSize: 18, fontWeight: 700, color: "var(--ink)",
};
function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--royal-50)", color: "var(--royal)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
    </span>
  );
}

/* ① この募集のポイント（3行まで・箇条書き） */
function PointsCard({ points }: { points: string[] }) {
  return (
    <section data-state="job-points" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, var(--royal-50) 100%)", border: "1.5px solid var(--royal-100)", borderRadius: 14, padding: "var(--space-6)" }}>
      <div style={SEC_TITLE}>
        <IconBox><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></IconBox>
        この募集のポイント
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
        {points.slice(0, 3).map((p) => (
          <li key={p} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 15, fontWeight: 600, lineHeight: 1.7, color: "var(--ink)" }}>
            <span aria-hidden style={{ flexShrink: 0, marginTop: 4, width: 18, height: 18, borderRadius: "50%", background: "var(--royal)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ② 仕事内容（長いときだけ畳む） */
function OverviewCard({ body }: { body: string }) {
  return (
    <section style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "var(--space-6)" }}>
      <div style={SEC_TITLE}>
        <IconBox><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></IconBox>
        仕事内容
      </div>
      <JobBodyFold>
        <Markdown jobBody>{body}</Markdown>
      </JobBodyFold>
    </section>
  );
}

/* 企業が書く側（求人の入力画面）の見本 */
function InputMock() {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        この募集のポイント <span style={{ fontSize: 12, fontWeight: 600, color: "var(--royal)" }}>おすすめ</span>
      </label>
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
        求人ページのいちばん上に出ます。1行に1つ、3行まで。求職者が最初に読む場所です。
      </p>
      <textarea readOnly rows={3} value={POINTS.join("\n")} style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", fontSize: 14, lineHeight: 1.7, resize: "none", fontFamily: "inherit" }} />
    </div>
  );
}

export default function Page() {
  devOnly();
  return (
    <main style={{ background: "var(--bg-tint, #F8FAFC)", minHeight: "100vh", padding: "24px 16px 80px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>この募集のポイント／仕事内容を畳む（見本）</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          この形は本番の求人ページに入れました（2026-11-25）。会社・本文はすべて架空です。ブラウザの幅を変えるとスマホの見え方も確かめられます。
        </p>

        <Variant label="A. ポイントあり＋長い仕事内容" note="ポイントは3行の箇条書き。仕事内容は 420px で畳み「続きを読む」で開く">
          <div style={{ display: "grid", gap: 16 }}>
            <PointsCard points={POINTS} />
            <OverviewCard body={LONG_BODY} />
          </div>
        </Variant>

        <Variant label="B. ポイントなし＋長い仕事内容（いまの COIN の求人と同じ状態）" note="ポイントが空なら枠ごと出さない。畳むのは同じ">
          <OverviewCard body={LONG_BODY} />
        </Variant>

        <Variant label="C. 短い仕事内容" note="短ければ畳まない。「続きを読む」のボタンも出ない">
          <OverviewCard body={SHORT_BODY} />
        </Variant>

        <Variant label="D. 企業が書く側（求人の入力画面）" note="いまの「この募集のポイント」の欄を、1行に1つ・3行までの形にする案">
          <InputMock />
        </Variant>
      </div>
    </main>
  );
}
