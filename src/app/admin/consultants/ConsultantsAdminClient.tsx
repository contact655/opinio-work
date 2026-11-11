"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminConsultant } from "@/lib/featuredConsultants/server";
import { CONSULTANTS_TITLE, ROUTE_CONSENT_METHODS, ROUTE_HOST_MESSAGE_MAX, ROUTE_TALK_TAGS, isoToJstLocal, type RouteTalkTag } from "@/lib/constants/careerRoutes";
import { addConsultant, deleteConsultant, setConsultantListed, updateConsultant, type ConsultantActionResult } from "./actions";

/**
 * ★相談できる人の運営画面の中身（2026-11-12）。書き込みは Server Action（actions.ts）だけ。
 * ⚠️ 取得に失敗したら「0件」と見せない（items が null）。
 * ⚠️ 職歴とは自動で照合しない。承認の前に、その人の職歴を目で確かめる。
 */
const box: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 12, background: "#fff", padding: 16 };
const input: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "8px 10px", fontSize: 14, fontFamily: "inherit", minWidth: 0, boxSizing: "border-box" };
const btn = (primary = false): React.CSSProperties => ({
  padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
  border: primary ? "none" : "1px solid var(--line)", background: primary ? "var(--royal)" : "#fff", color: primary ? "#fff" : "var(--ink)",
});

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ConsultantActionResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError(r.error); return; }
      after?.();
      router.refresh();
    });
  };
  return { pending, error, run };
}

export function ConsultantsAdminClient({ items }: { items: AdminConsultant[] | null }) {
  const [userKey, setUserKey] = useState("");
  const { pending, error, run } = useAction();
  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 1000, padding: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{CONSULTANTS_TITLE}</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7 }}>
          ユーザー一覧（/people）の左サイドバーに出す人です。出るのは、本人の同意を記録して承認した人だけです。
          職歴とは自動で照合しません。承認する前に、下に出る職歴を目で確かめてください。
        </p>
      </div>
      {items === null ? (
        <p data-state="consultants-admin-error" style={{ color: "var(--error)", fontWeight: 600 }}>読み込みに失敗しました（0件という意味ではありません）。</p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input style={{ ...input, flex: "1 1 260px" }} value={userKey} onChange={(e) => setUserKey(e.target.value)} placeholder="登録する人（メールアドレス・username・id）" />
            <button type="button" style={btn(true)} disabled={pending} onClick={() => run(() => addConsultant(userKey), () => setUserKey(""))}>登録</button>
            {error && <span role="alert" style={{ color: "var(--error)", fontSize: 13, fontWeight: 600 }}>{error}</span>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
            サイドバーに出ている人 {items.filter((c) => c.blockers.length === 0).length}人 / 登録 {items.length}人
          </p>
          {items.length === 0 && <p data-state="consultants-admin-empty" style={{ color: "var(--ink-soft)" }}>まだ登録されている人はいません。</p>}
          {items.map((c) => <ConsultantRow key={c.id} item={c} />)}
        </>
      )}
    </div>
  );
}

function ConsultantRow({ item }: { item: AdminConsultant }) {
  const [tags, setTags] = useState<RouteTalkTag[]>(item.talkTags);
  const [message, setMessage] = useState(item.message ?? "");
  const [order, setOrder] = useState(String(item.displayOrder));
  const [consentAt, setConsentAt] = useState(isoToJstLocal(item.consentConfirmedAt));
  const [consentMethod, setConsentMethod] = useState(item.consentMethod ?? "");
  const { pending, error, run } = useAction();
  const shown = item.blockers.length === 0;
  const toggle = (t: RouteTalkTag) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  return (
    <section data-state={shown ? "consultant-listed" : "consultant-unlisted"} style={{ ...box, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <a href={`/u/${encodeURIComponent(item.profileKey)}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: "var(--ink)" }}>{item.name}</a>
        <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>{item.email ?? "（メールなし）"}</span>
        {item.isTest && <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>検証用アカウント</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: shown ? "var(--royal)" : "var(--ink-soft)" }}>
          {shown ? "サイドバーに掲載中" : `掲載していない：${item.blockers.join("・")}`}
        </span>
      </div>

      <div style={{ background: "var(--bg-tint)", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>職歴（古い順・運営の確認用。会社名は伏せずに出しています）</div>
        {item.experiences.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>職歴が登録されていません</div>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, fontSize: 13, lineHeight: 1.6 }}>
            {item.experiences.map((e) => (
              <li key={e.id}>
                {(e.startedAt ?? "?").slice(0, 7)}〜{e.isCurrent ? "現在" : (e.endedAt ?? "?").slice(0, 7)}　{e.company}{e.role ? ` ／ ${e.role}` : ""}
                {e.visibilityCompany && e.visibilityCompany !== "real" && <span style={{ color: "var(--ink-mute)" }}>（公開では会社名を伏せている）</span>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13 }}>話せること
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {ROUTE_TALK_TAGS.map((t) => (
              <button key={t.value} type="button" aria-pressed={tags.includes(t.value)} onClick={() => toggle(t.value)}
                style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12.5, fontFamily: "inherit", cursor: "pointer",
                  border: `1.5px solid ${tags.includes(t.value) ? "var(--royal)" : "var(--line)"}`, background: tags.includes(t.value) ? "var(--royal-50)" : "#fff",
                  color: tags.includes(t.value) ? "var(--royal)" : "var(--ink-soft)", fontWeight: tags.includes(t.value) ? 700 : 500 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 13 }}>本人のひとこと（{message.length} / {ROUTE_HOST_MESSAGE_MAX}）
          <textarea style={{ ...input, resize: "vertical" }} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>表示順（小さいほど上）
          <input style={{ ...input, width: 90 }} value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" />
        </label>
        <fieldset data-state="consultant-consent" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", margin: 0, display: "grid", gap: 8, minWidth: 0 }}>
          <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", padding: "0 4px" }}>本人の同意（承認に必要）</legend>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>確認した日時
              <input type="datetime-local" style={input} value={consentAt} onChange={(e) => setConsentAt(e.target.value)} />
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>確認した方法
              <select style={input} value={consentMethod} onChange={(e) => setConsentMethod(e.target.value)}>
                <option value="">選んでください</option>
                {ROUTE_CONSENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </label>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>日時は日本時間。入れたら「内容を保存」を押してから承認してください（承認は保存済みの記録で判断します）</div>
        </fieldset>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" style={btn()} disabled={pending}
          onClick={() => run(() => updateConsultant(item.id, { talkTags: tags, message, displayOrder: order, consentConfirmedAt: consentAt, consentMethod }))}>
          内容を保存
        </button>
        {item.isListed ? (
          <button type="button" data-action="consultant-unlist" style={btn()} disabled={pending} onClick={() => run(() => setConsultantListed(item.id, false))}>承認を取り消す</button>
        ) : (
          <button type="button" data-action="consultant-approve" style={btn(true)} disabled={pending} onClick={() => run(() => setConsultantListed(item.id, true))}>同意と経歴を確かめたので承認する</button>
        )}
        <button type="button" style={{ ...btn(), color: "var(--error)" }} disabled={pending}
          onClick={() => { if (window.confirm(`${item.name} さんの登録を外しますか？（プロフィールや職歴には触りません）`)) run(() => deleteConsultant(item.id)); }}>
          登録を外す
        </button>
        {item.approvedAt && <span style={{ fontSize: 12, color: "var(--ink-mute)" }}>承認日 {item.approvedAt.slice(0, 10)}</span>}
        {error && <span role="alert" style={{ color: "var(--error)", fontSize: 13, fontWeight: 600 }}>{error}</span>}
      </div>
    </section>
  );
}
