"use client";

import { useEffect, useRef, useState } from "react";
import type { NotificationTeamMember } from "@/lib/business/notificationTeam";

/*
 * ★企業への通知先（2026-10-12 に /biz/company の設定タブから「メンバーと権限」へ移した / 柴さんの指示）。
 *   **下書きを通さず即時保存**（PUT /api/biz/company/notification-emails）。
 *   それまでは企業ページの下書きに入り「変更を公開する」まで効かなかった。
 * ⚠️ 選び方の決まり（担当者から選ぶ＋その他のアドレス／既定と「宛先を選ぶ」の2択／上書きであることを出す）は
 *    下の NotificationRecipients の注記のまま。中身は移しただけで変えていない。
 */

function FormLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
      {children}
      {optional && <span style={{ color: "var(--ink-mute)", fontSize: 10, fontWeight: 400 }}>任意</span>}
    </label>
  );
}

function FormHint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6, lineHeight: 1.7 }}>{children}</div>;
}

/** 大文字小文字を無視して比べる。⚠️ メールのローカル部は本来大小を区別するが、
 *  実運用で区別している事業者はほぼ無く、区別すると同じ人を2回選べてしまう。 */
const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * 企業への通知先を選ぶ（2026-09-29 / 柴さんの指示）。
 *
 * ── なぜ作ったか ──────────────────────────────────────────────────────────
 * それまでは**カンマ区切りのメールアドレスだけ**で、
 * `recruiting@example.co.jp` と並んでいても**誰のアドレスか分からなかった。**
 * 実測（2026-09-29 / 本番）: この列を設定している企業は **0社**。
 * ＝ **一度も使われないまま**、実際に効いていたのはフォールバック（②有効な管理者）だけ。
 *
 * → その会社の **OPINIO アカウントから選ぶ**形にした。名前・部門・職種・メールが出る。
 *
 * ⚠️★**自由入力を消さないこと。** `recruiting@` のような共有メールボックスや
 *    採用代行など、**OPINIO アカウントを持たない宛先が実在する。**
 *
 * ⚠️★**保存先は今までどおり `notification_emails`（text[]）。** 選んだ人の
 *    「メールアドレスだけ」を入れる。**`user_id` で持つ形に変えていない。**
 *    理由: `lib/notify/recipients.ts` がアドレスの配列を期待しており、
 *    ここだけ構造を変えると**宛先の解決が2通りに割れる**（そちらのほうが危ない）。
 *    ⚠️ 引き換えに、その人が OPINIO のメールアドレスを変えても追随しない。
 *       いまは**本人がメールアドレスを変える機能が存在しない**ので実害は無い
 *       （CLAUDE.md「`email` は本人向けの変更機能が無いから GRANT を落としている」）。
 *       **変更機能を作る日は、ここも一緒に考えること。**
 *
 * ⚠️★**「上書き」であることを画面に出す。** `notification_emails` は
 *    既定の宛先への**追加ではなく上書き**（`recipients.ts` の解決順①）。
 *    1人でも選ぶと、選ばなかった管理者には**届かなくなる。**
 */
function NotificationRecipients({
  value,
  onChange,
  members,
}: {
  value: string;
  onChange: (v: string) => void;
  members: NotificationTeamMember[];
}) {
  const emails = value ? value.split(",").map((e) => e.trim()).filter(Boolean) : [];

  /** 担当者のアドレスに当たらないもの＝共有アドレスなど。⚠️ 落とさずに必ず残す */
  const others = emails.filter((e) => !members.some((m) => sameEmail(m.email, e)));
  const isSelected = (m: NotificationTeamMember) => emails.some((e) => sameEmail(m.email, e));

  /**
   * ★並びは常に「担当者（`members` の順）→ その他」に組み直す。
   *
   * ⚠️★**押した順に足す形にしないこと**（2026-09-29 に実際に食い違った）。
   *    チェックを付けた経路と、その他のアドレスを足した経路とで**並びが変わり**、
   *    同じ宛先なのに「いまの宛先」の表示順が操作の順番で変わる。
   *    保存値（`notification_emails`）にも順序が残るので、**中身が同じでも差分が出て
   *    「未公開の変更あり」が無意味に点く。**
   */
  function rebuild(selectedEmails: string[], otherEmails: string[]) {
    const ordered = members.filter((m) => selectedEmails.some((e) => sameEmail(m.email, e))).map((m) => m.email);
    onChange([...ordered, ...otherEmails].join(", "));
  }

  function toggle(m: NotificationTeamMember) {
    const selected = members.filter(isSelected).map((x) => x.email);
    const nextSelected = isSelected(m)
      ? selected.filter((e) => !sameEmail(m.email, e))
      : [...selected, m.email];
    rebuild(nextSelected, others);
  }

  /** その他のアドレスだけを置き換える。⚠️ 選択済みの担当者を巻き込まないこと */
  function setOthers(v: string) {
    const nextOthers = v ? v.split(",").map((e) => e.trim()).filter(Boolean) : [];
    rebuild(members.filter(isSelected).map((m) => m.email), nextOthers);
  }

  /** 未設定のときに実際に届く人（`recipients.ts` の②）。⚠️ 条件を変えるならあちらと揃える */
  const fallback = members.filter((m) => m.isAdminPermission);

  /* ★★2択にした（2026-10-08 / 柴さんの指示）。
        それまでは未設定のとき**チェックが全部外れているのに**、説明文だけが
        「いまは◯◯（管理者）に届きます」と言っていた。**見た目と実際の宛先が食い違う。**
     ・既定（管理者全員）… 管理者を**灰色のチェック済み**で示す。押せない
     ・宛先を選ぶ          … チェックと自由入力で選ぶ（`notification_emails` に保存＝上書き）
     ⚠️ モードは local state で持つ。値から毎回導くと、「選ぶ」にした直後（まだ0件）に
        既定へ戻ってしまう。
     ⚠️★既定へ戻すと `notification_emails` を空にする（＝既定の宛先に戻る）。 */
  const [mode, setMode] = useState<"default" | "custom">(emails.length > 0 ? "custom" : "default");

  function chooseDefault() {
    setMode("default");
    onChange("");
  }
  function chooseCustom() {
    setMode("custom");
    /* ⚠️ 0件から始めない。既定と同じ顔ぶれを最初の状態にして、そこから外す・足す形にする
          （0件のままだと保存値が空＝既定のまま、という分かりにくい状態になる） */
    if (emails.length === 0) rebuild(fallback.map((m) => m.email), []);
  }

  const radio = (key: "default" | "custom", label: string, hint: string, onPick: () => void) => (
    <label style={{
      display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer",
      padding: "8px 10px", borderRadius: 8,
      border: `1.5px solid ${mode === key ? "var(--royal)" : "var(--line)"}`,
      background: mode === key ? "var(--royal-50)" : "#fff",
    }}>
      <input type="radio" name="notif-mode" checked={mode === key} onChange={onPick}
        style={{ marginTop: 3, accentColor: "var(--royal)", cursor: "pointer" }} />
      <span>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{label}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{hint}</span>
      </span>
    </label>
  );

  return (
    <div>
      <div role="radiogroup" aria-label="通知の宛先" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {radio("default", "管理者全員（既定）",
          fallback.length > 0
            ? "管理者権限の担当者全員に届きます。担当者が増えると自動で宛先に入ります。"
            : "管理者権限の担当者がいないため、いまは運営に届きます。",
          chooseDefault)}
        {radio("custom", "宛先を選ぶ",
          "ここで選んだ宛先だけに届きます（選ばなかった担当者には届きません）。",
          chooseCustom)}
      </div>

      {members.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {members.map((m) => {
            /* ★既定のときは「実際に届く人」をチェック済みで示す（押せない） */
            const isDefault = mode === "default";
            const checked = isDefault ? m.isAdminPermission : isSelected(m);
            /* ⚠️ 値が無ければ出さない（「—」や「所属不明」で埋めない） */
            const sub = [m.department, m.roleTitle].filter(Boolean).join(" ・ ");
            return (
              <label
                key={m.email}
                data-state={isDefault ? (checked ? "default-on" : "default-off") : (checked ? "on" : "off")}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  cursor: isDefault ? "default" : "pointer",
                  padding: "10px 12px", borderRadius: 8,
                  border: `1.5px solid ${checked && !isDefault ? "var(--royal)" : "var(--line)"}`,
                  background: isDefault ? "var(--bg-tint)" : checked ? "var(--royal-50)" : "#fff",
                  opacity: isDefault && !checked ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={isDefault}
                  onChange={() => toggle(m)}
                  style={{ marginTop: 2, width: 16, height: 16, cursor: isDefault ? "default" : "pointer", flexShrink: 0 }}
                />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isDefault ? "var(--ink-soft)" : "var(--ink)" }}>{m.name}</span>
                    {sub && <span style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>{sub}</span>}
                    {!m.isAdminPermission && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "var(--ink-mute)",
                        border: "1px solid var(--line)", borderRadius: 100, padding: "1px 6px",
                      }}>閲覧のみ</span>
                    )}
                  </span>
                  <span style={{
                    display: "block", fontSize: 12, color: "var(--ink-soft)", marginTop: 2,
                    overflowWrap: "anywhere",
                  }}>{m.email}</span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <FormHint>
          この会社にはまだ OPINIO の担当者が登録されていません。
          {mode === "custom" ? "下の欄にメールアドレスを直接入力してください。" : ""}
        </FormHint>
      )}

      {/* ⚠️★**自由入力を消さないこと。** 共有メールボックスや採用代行の宛先が実在する。
             ⚠️ 自由入力も既定の宛先を**上書き**するので、「宛先を選ぶ」のときだけ出す。 */}
      {mode === "custom" && (
        <>
          <FormLabel optional>その他のアドレス</FormLabel>
          <EmailTagInput value={others.join(", ")} onChange={setOthers} />
          <FormHint>
            recruiting@ のような共有アドレスを追加できます（Enter またはカンマで区切ります）。
          </FormHint>
          {/* ⚠️ 数ではなく**宛先そのもの**を出す。数だけだと誰が外れたか分からない */}
          {emails.length === 0 ? (
            <FormHint>
              宛先が1つも選ばれていないため、いまは管理者全員に届きます。
            </FormHint>
          ) : (
            <FormHint>
              いまの宛先: <strong style={{ color: "var(--ink)" }}>{emails.join(" ・ ")}</strong>
            </FormHint>
          )}
        </>
      )}
    </div>
  );
}

function EmailTagInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tags = value ? value.split(",").map((e) => e.trim()).filter(Boolean) : [];
  const [inputVal, setInputVal] = useState("");

  function commit(raw: string) {
    const email = raw.trim();
    if (!email) return;
    const next = [...tags, email].join(", ");
    onChange(next);
    setInputVal("");
  }

  function remove(idx: number) {
    const next = tags.filter((_, i) => i !== idx).join(", ");
    onChange(next);
  }

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
      padding: "8px 10px", border: "1.5px solid var(--line)", borderRadius: 8,
      background: "#fff", cursor: "text", minHeight: 42,
    }}
      onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          background: "var(--royal-50)", color: "var(--royal)",
          border: "1px solid var(--royal-100)", borderRadius: 6,
          fontSize: 12, fontWeight: 500, padding: "2px 8px",
        }}>
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); remove(i); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1, color: "var(--royal)", fontSize: 13, fontWeight: 700 }}
          >×</button>
        </span>
      ))}
      <input
        type="email"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(inputVal); }
          if (e.key === "Backspace" && !inputVal && tags.length > 0) remove(tags.length - 1);
        }}
        onBlur={() => { if (inputVal) commit(inputVal); }}
        placeholder={tags.length === 0 ? "recruiting@example.co.jp" : "追加..."}
        style={{ border: "none", outline: "none", fontSize: 13, fontFamily: "inherit", color: "var(--ink)", flex: "1 1 160px", minWidth: 120, background: "transparent" }}
      />
    </div>
  );
}


type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * 「メンバーと権限」に置く通知先のカード。変えたらその場で保存する。
 * ⚠️ 閲覧のみの担当者には変更させない（保存 API も管理者以外は 403）。
 */
export function NotificationRecipientsCard({
  members,
  initialEmails,
  canEdit,
}: {
  members: NotificationTeamMember[];
  initialEmails: string[];
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initialEmails.join(", "));
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const touched = useRef(false);

  useEffect(() => {
    if (!touched.current) return;
    setState("saving");
    const t = setTimeout(async () => {
      try {
        const emails = value ? value.split(",").map((e) => e.trim()).filter(Boolean) : [];
        const res = await fetch("/api/biz/company/notification-emails", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails }),
        });
        const d = await res.json().catch(() => null);
        if (!res.ok) {
          setError(d?.error ?? "保存できませんでした。時間をおいてもう一度お試しください。");
          setState("error");
          return;
        }
        setError(null);
        setState("saved");
      } catch {
        setError("保存できませんでした。通信状況をご確認ください。");
        setState("error");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <section data-state="notification-recipients" style={{
      background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "22px 24px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: 0 }}>通知の宛先</h2>
        <span aria-live="polite" style={{ fontSize: 12, color: state === "error" ? "var(--error-ink)" : "var(--ink-mute)" }}>
          {state === "saving" ? "保存中..." : state === "saved" ? "保存しました" : state === "error" ? "保存できませんでした" : ""}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.7, margin: "0 0 14px" }}>
        応募・カジュアル面談の申し込み・参加のリクエストが届いたときに、お知らせのメールを送る宛先です。変えるとすぐに保存されます。
      </p>
      {canEdit ? (
        <NotificationRecipients
          value={value}
          onChange={(v) => { touched.current = true; setValue(v); }}
          members={members}
        />
      ) : (
        <FormHint>通知の宛先は管理者権限の担当者が変更できます。</FormHint>
      )}
      {error && <p role="alert" style={{ fontSize: 12, color: "var(--error-ink)", margin: "10px 0 0" }}>{error}</p>}
    </section>
  );
}
