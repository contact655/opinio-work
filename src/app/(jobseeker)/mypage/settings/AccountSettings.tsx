"use client";

/**
 * `/mypage/settings` の中身（2026-08-17 / フェーズ4-1）。
 *
 * **ログイン情報 / メール通知 / アカウント削除**の3つだけ。
 *
 * ⚠️ **公開範囲・スカウト設定・転職検討状況はここに置かない。**
 *    あの3つは「プロフィールがどう見えるか」の話で、`/mypage` のヘッダー下の
 *    ボックスに要約が出る。**要約が出る場所と直す場所を離さない**（フェーズ4-2）。
 *    ここに同じものを置くと、同じ設定が2箇所に並ぶ（ルール⑧）。
 *
 * ⚠️ 中身は「設定」タブから**そのまま移した**。ロジックは変えていない。
 */

import { useState, useEffect } from "react";
import { EMAIL_SETTING_DEFAULTS, type EmailSettingKey } from "@/lib/constants/emailSettings";
import { FormSection, FormGroup, inputStyle } from "@/components/profile/editor/formKit";

type NotifPrefs = Record<EmailSettingKey, boolean>;
const DEFAULT_NOTIF: NotifPrefs = EMAIL_SETTING_DEFAULTS;

function NotificationSettingsSection() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/jobseeker/email-settings");
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!alive) return;
        setPrefs({
          email_weekly_enabled: json.email_weekly_enabled !== false,
          email_scout_enabled: json.email_scout_enabled !== false,
        });
      } catch {
        /* ⚠️ 読めなかったときに既定値のトグルを操作可能にしない。
              保存されていない値を「保存済み」に見せることになる。 */
        if (alive) setError("設定を読み込めませんでした。再読み込みしてください");
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const toggle = async (key: keyof NotifPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    const prev = prefs;
    setPrefs(next); // 楽観的更新
    setError(null);
    try {
      const res = await fetch("/api/jobseeker/email-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      setPrefs(prev); // ⚠️ 失敗したら戻す。「保存済み」と誤解させない
      setError("保存に失敗しました。時間をおいて試してください");
    }
  };

  const items: { key: keyof NotifPrefs; label: string; desc: string; icon: string }[] = [
    { key: "email_weekly_enabled", label: "週1回のおすすめメール", desc: "新着求人と、希望条件に合う求人をまとめてお送りします", icon: "💼" },
    { key: "email_scout_enabled",  label: "スカウトのお知らせ", desc: "企業からスカウトが届いたときにメールでお知らせします", icon: "📬" },
  ];

  return (
    <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 14, padding: "24px 24px 20px", marginBottom: "var(--space-6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>メール通知設定</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            受け取りたいお知らせを選択してください。設定はいつでも変更できます。
          </div>
        </div>
        {saved && (
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            保存済み
          </span>
        )}
      </div>
      {error && (
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--error)" }}>{error}</div>
      )}
      {/* ⚠️ 読み込みが終わるまで操作させない。既定値のまま触らせると、
             保存されていない値を「保存済み」と見せることになる */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: "var(--space-3)", opacity: loaded ? 1 : 0.5, pointerEvents: loaded ? "auto" : "none" }}>
        {items.map(({ key, label, desc, icon }) => (
          <label
            key={key}
            style={{
              display: "flex", alignItems: "flex-start", gap: 14,
              padding: "14px 16px", borderRadius: 10,
              border: `1px solid ${prefs[key] ? "var(--royal-100)" : "var(--line)"}`,
              background: prefs[key] ? "var(--royal-50)" : "var(--bg-tint)",
              cursor: "pointer", transition: "all 0.15s",
            }}
          >
            <span style={{ fontSize: "var(--text-lg)", flexShrink: 0, marginTop: 1 }}>{icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-soft)", lineHeight: 1.6 }}>{desc}</div>
            </div>
            <div style={{ flexShrink: 0, marginTop: 2 }}>
              {/* Toggle switch */}
              <div
                onClick={(e) => { e.preventDefault(); toggle(key); }}
                style={{
                  width: 40, height: 22, borderRadius: 100,
                  background: prefs[key] ? "var(--royal)" : "#CBD5E1",
                  position: "relative", cursor: "pointer", transition: "background 0.2s",
                }}
              >
                <div style={{
                  position: "absolute", top: 3,
                  left: prefs[key] ? 21 : 3,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "#fff", transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>
          </label>
        ))}
      </div>
      <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-tint)", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "var(--ink-soft)", lineHeight: 1.7 }}>
        💡 メール通知の配信は登録メールアドレスに送られます。迷惑メールフォルダもご確認ください。
      </div>
    </div>
  );
}

export default function AccountSettings({ authEmail }: { authEmail: string }) {
  /* ⚠️ 中央寄せにしない（2026-08-25）。同じ画面の上2つのセクションは左端300pxで、
     ここだけ490pxから始まっていた。幅を絞るのは可・寄せるのは不可。 */
  return (
    <div style={{ maxWidth: 720, padding: "8px 0 40px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>設定</h1>
      <p style={{ fontSize: 13, color: "var(--ink-mute)", margin: "0 0 24px", lineHeight: 1.7 }}>
        ログイン情報とメール通知の設定です。プロフィールの公開範囲は
        <a href="/mypage" style={{ color: "var(--royal)", fontWeight: 600, textDecoration: "none" }}>マイページ</a>
        の「転職の希望」から変更できます。
      </p>
      <div style={{ maxWidth: 680 }}>

        {/* ── Section 2: ログイン情報 ───────────────────────────────────── */}
        <FormSection title="ログイン情報">
          <FormGroup label="メールアドレス" htmlFor="pe-email">
            <input
              id="pe-email"
              type="email"
              autoComplete="email"
              value={authEmail}
              readOnly
              style={{ ...inputStyle(), background: "var(--bg-tint)", color: "var(--ink-soft)", cursor: "default" }}
            />
          </FormGroup>
          <div style={{ marginBottom: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>
              パスワード
            </div>
            <button
              type="button"
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: 600,
                border: "1px solid var(--line)", borderRadius: 8,
                background: "#fff", color: "var(--ink)", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              パスワードを変更
            </button>
          </div>
        </FormSection>

        {/* ── Section 3: メール通知設定 ────────────────────────────────── */}
        <NotificationSettingsSection />

        {/* ── Danger zone ──────────────────────────────────────────────── */}
        <div
          style={{
            background: "var(--error-soft)", border: "1px solid #FECACA",
            borderRadius: 14, padding: "20px 24px", marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--error)", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>アカウント削除
          </div>
          {/*
            ⚠️ **ここに「削除する」ボタンを置かないこと**（2026-08-23）。
               それまで置いてあったボタンには `onClick` が無く、**押しても何も
               起きなかった。** 削除を行う API も存在しない
               （`/api/**` に該当ルート0件、`ow_users` を DELETE するのは
                運営画面 `/admin/candidates` の一括削除だけ）。

               プライバシーポリシー 11-4 は「退会した場合、保有個人データを
               速やかに削除します」と約束している。**動かないボタンは、
               利用者に「削除を申し出た」と誤解させる**ので、
               実際に動く経路（メール）への案内に差し替えた。

            ⚠️ **セルフサービスの削除を実装するときは、まず何を消して何を残すかを
               決めること。** ここを決めずに `auth.users` を消すと連鎖する——
               `ow_users` を参照する FK 45列のうち **29列が ON DELETE CASCADE** で、
               投稿・職歴・会話・応募まで巻き込まれる（CLAUDE.md）。
               企業側に既に届いた応募や、相手のいる会話をどう扱うかは
               別途設計が要る。**それまではこの案内のままにする。**
          */}
          <div style={{ fontSize: 12, fontWeight: 500, color: "#991B1B", marginBottom: 12, lineHeight: 1.7 }}>
            アカウントの削除をご希望の場合は、下記のメールアドレスまでご連絡ください。
            ご連絡から<strong>7営業日以内</strong>に対応します。
          </div>
          <a
            href="mailto:contact@opinio.co.jp?subject=%E3%82%A2%E3%82%AB%E3%82%A6%E3%83%B3%E3%83%88%E5%89%8A%E9%99%A4%E3%81%AE%E3%81%94%E4%BE%9D%E9%A0%BC&body=%E3%82%A2%E3%82%AB%E3%82%A6%E3%83%B3%E3%83%88%E3%81%AE%E5%89%8A%E9%99%A4%E3%82%92%E5%B8%8C%E6%9C%9B%E3%81%97%E3%81%BE%E3%81%99%E3%80%82%0A%0A%E3%80%90%E7%99%BB%E9%8C%B2%E3%83%A1%E3%83%BC%E3%83%AB%E3%82%A2%E3%83%89%E3%83%AC%E3%82%B9%E3%80%91%0A%0A%E3%80%90%E3%81%8A%E5%90%8D%E5%89%8D%E3%80%91%0A"
            style={{
              display: "inline-block",
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              border: "1px solid var(--error)", borderRadius: 8,
              background: "#fff", color: "var(--error)",
              fontFamily: "inherit", textDecoration: "none",
            }}
          >
            contact@opinio.co.jp
          </a>
          <div style={{ fontSize: 12, fontWeight: 500, color: "#991B1B", marginTop: 12, lineHeight: 1.7 }}>
            削除すると、プロフィール・職歴・投稿などのデータを削除します。
            取材済みの記事は掲載を続ける場合があります。
            {/* ⚠️ 法令上の保存義務があるものは残る。ここを「すべて完全に削除」と
                   書き切らないこと（プライバシーポリシー 11-4 と食い違う）。 */}
            職業安定法により保存が義務づけられている帳簿書類は、法令の定めに従って保存します。
          </div>
        </div>
      </div>
    </div>
  );
}
