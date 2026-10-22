/**
 * ★企業向けLP（/business）の画面の見本（2026-10-22 / 柴さんの了承。見本 https://claude.ai/artifact/Rds7ioFQc3LgGb5mk3EnEi）。
 *
 * ⚠️★**名前・経歴・社名はすべて架空。** ページ側に「画面はイメージです」の注記を必ず置くこと。
 * ⚠️ 画像ファイルにしない（文言を直すたびに作り直すことになる）。描くだけで DB を読まない。
 * ⚠️ 実在の数字（登録者数・応募数など）を入れないこと。/business の冒頭の注記と同じ。
 * ⚠️ 「業界を問わない」のような、値が無いときの決まり文句を見本にも書かない。
 */
import type React from "react";

const CARD: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
  boxShadow: "0 12px 32px rgba(11,26,51,0.08)", overflow: "hidden",
};
const AVATAR: React.CSSProperties = { width: 40, height: 40, borderRadius: "50%", background: "var(--royal-50)", flexShrink: 0 };
const MUTE: React.CSSProperties = { color: "var(--ink-mute)" };
const PILL: React.CSSProperties = { border: "1px solid var(--royal-100)", borderRadius: 99, padding: "3px 11px", fontSize: 12, whiteSpace: "nowrap" };

/** 最初の画面の右。企業ページの見本 */
export function CompanyPageMock() {
  const people = [
    { role: "法人営業", from: "前職 SIer" },
    { role: "CS", from: "前職 広告代理店" },
    { role: "エンジニア", from: "新卒入社" },
  ];
  return (
    <div style={{ ...CARD, borderRadius: 16, boxShadow: "0 24px 60px rgba(11,26,51,0.12)" }} aria-hidden="true">
      <div style={{ height: 60, background: "#0b1a33" }} />
      <div style={{ padding: "0 22px 22px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -26 }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: "#2f5bd3", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, border: "3px solid #fff" }}>A</div>
          <div style={{ paddingBottom: 2, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>株式会社サンプル</div>
            <div style={{ fontSize: 12, ...MUTE }}>CRM・営業支援 ／ 東京都</div>
          </div>
        </div>
        <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700, color: "var(--ink-soft)" }}>ここで働いている人</div>
        <div style={{ marginTop: 8, display: "flex", height: 8, borderRadius: 99, overflow: "hidden" }}>
          <span style={{ width: "46%", background: "var(--royal)" }} />
          <span style={{ width: "30%", background: "#2f8fd3" }} />
          <span style={{ width: "24%", background: "#9bb3df" }} />
        </div>
        <div style={{ marginTop: 6, display: "flex", gap: 14, fontSize: 11.5, flexWrap: "wrap", ...MUTE }}>
          <span>営業</span><span>カスタマーサクセス</span><span>エンジニア</span>
        </div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {people.map((p) => (
            <div key={p.role} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ ...AVATAR, margin: "0 auto" }} />
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700 }}>{p.role}</div>
              <div style={{ fontSize: 11, lineHeight: 1.5, ...MUTE }}>{p.from}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          この会社から転職した人のいま：外資系IT企業の営業 ／ 事業責任者 ／ 起業
        </div>
      </div>
    </div>
  );
}

/** 1 企業ページ */
export function CompanyTabsMock() {
  const facts = [["事業領域", "CRM・営業支援"], ["顧客の業界", "製造業・小売"], ["拠点", "東京・大阪"], ["募集", "法人営業 ほか"]];
  return (
    <div style={{ ...CARD, padding: 20 }} aria-hidden="true">
      <div style={{ display: "flex", gap: 14, borderBottom: "1px solid var(--line)", fontSize: 13, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: "var(--royal)", borderBottom: "2px solid var(--royal)", paddingBottom: 8 }}>概要</span>
        <span style={MUTE}>社員</span><span style={MUTE}>募集</span><span style={MUTE}>製品</span>
      </div>
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, fontSize: 12.5 }}>
        {facts.map(([k, v]) => (
          <div key={k} style={{ background: "var(--bg-tint)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, ...MUTE }}>{k}</div>{v}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>社員・元社員</div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        {[0, 1, 2].map((i) => <span key={i} style={{ ...AVATAR, width: 34, height: 34 }} />)}
        <span style={{ ...AVATAR, width: 34, height: 34, background: "var(--bg-tint)" }} />
      </div>
    </div>
  );
}

/** 2 募集をつくる */
export function JobMock() {
  const rows = [
    ["この職種の経験者（社員）", "企業ページから自動で並ぶ", false],
    ["応募", "新着あり", true],
    ["カジュアル面談の申し込み", "新着あり", true],
  ] as const;
  return (
    <div style={{ ...CARD, padding: 20 }} aria-hidden="true">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700 }}>法人営業（SaaS）</div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1f7a4d", background: "#e5f4ec", borderRadius: 99, padding: "3px 10px" }}>公開中</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 12, ...MUTE }}>東京都 ／ 正社員 ／ 年収 600〜900万円</div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
        {rows.map(([k, v, strong]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px" }}>
            <span style={{ minWidth: 0 }}>{k}</span>
            <span style={strong ? { fontWeight: 700, color: "var(--royal)", whiteSpace: "nowrap" } : { ...MUTE, whiteSpace: "nowrap" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 3 企業記事を書く */
export function StoryMock() {
  return (
    <div style={{ ...CARD, padding: 20 }} aria-hidden="true">
      <div style={{ height: 120, borderRadius: 10, background: "linear-gradient(135deg, var(--royal-50), var(--bg-tint))" }} />
      <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 700, color: "#2f5bd3" }}>企業記事</div>
      <div style={{ marginTop: 4, fontWeight: 700, lineHeight: 1.6 }}>営業チームが、顧客の現場に週3日いる理由</div>
      <div style={{ marginTop: 6, fontSize: 12, ...MUTE }}>株式会社サンプル ／ 営業部</div>
    </div>
  );
}

/** 4 人を探して、声をかける */
export function CandidateSearchMock() {
  const people = [
    { title: "法人営業 ／ SaaS", sub: "社会人7年・東京都", waiting: false },
    { title: "インサイドセールス", sub: "社会人5年・神奈川県", waiting: true },
  ];
  return (
    <div style={{ ...CARD, padding: 20 }} aria-hidden="true">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ ...PILL, background: "var(--royal)", color: "#fff", borderColor: "var(--royal)" }}>経験職種：営業</span>
        <span style={PILL}>社会人5年以上</span>
        <span style={PILL}>お住まい：東京都</span>
        <span style={PILL}>転職への意向</span>
      </div>
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {people.map((p) => (
          <div key={p.title} style={{ display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
            <span style={AVATAR} />
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>
              <div style={{ fontWeight: 700 }}>{p.title}</div>
              <div style={MUTE}>{p.sub}</div>
            </div>
            {p.waiting
              ? <span style={{ fontSize: 12, fontWeight: 700, color: "var(--royal)", border: "1px solid var(--royal-100)", borderRadius: 8, padding: "7px 12px", whiteSpace: "nowrap" }}>返事待ち</span>
              : <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--royal)", borderRadius: 8, padding: "8px 12px", whiteSpace: "nowrap" }}>メッセージ</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 5 OPINIOからの紹介 */
export function ProposalMock() {
  const reasons = ["御社の営業の方と、前職が同じ業界", "希望する職種が、募集の職種と同じ", "ひとこと：「SaaSの営業を続けたいと考えています」"];
  return (
    <div style={{ ...CARD, padding: 20 }} aria-hidden="true">
      <div style={{ fontSize: 12, fontWeight: 700, color: "#2f5bd3" }}>OPINIOからの紹介</div>
      <div style={{ marginTop: 8, fontWeight: 700, lineHeight: 1.6 }}>法人営業の募集に、話を聞いてみたい方がいます</div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "var(--ink-soft)" }}>
        {reasons.map((r) => (
          <div key={r} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--royal)", flexShrink: 0, transform: "translateY(-1px)" }} />{r}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, color: "#fff", background: "var(--royal)", borderRadius: 8, padding: "8px 14px" }}>会話を開く</span>
      </div>
    </div>
  );
}
