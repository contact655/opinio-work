"use client";

import React, { useState } from "react";
import { BUSINESS_CONTACT_LIMITS } from "@/lib/constants/businessContact";

/*
 * ⚠️★**保存経路があることを前提にした入力UIである**（CLAUDE.md
 *    「保存経路（API 呼び出し・DB INSERT）が無い入力 UI は実装しない」）。
 *    送信先は `POST /api/business/contact` → 運営宛メール。**DB には残らない。**
 *
 * ⚠️★**API が失敗したら、失敗として見せること。** 成功画面に倒さない。
 *    保存先がメールしか無いので、握り潰すと問い合わせが消える。
 *    失敗時はメールアドレスを添えて、利用者が別の手段を取れるようにする。
 *
 * ⚠️ 上限は `BUSINESS_CONTACT_LIMITS` を見る。**ここに数字を書かない**
 *    （API と割れると「入力できるのに送信で 400」になる）。
 *
 * ⚠️ `website` はハニーポット。**消さないこと。**
 *    人間には見えない欄で、埋まっていればボットとして API 側が静かに捨てる。
 *    ⚠️ `type="hidden"` にしない（ボットが hidden を避けることがある）。
 *       `tabIndex={-1}` と `autoComplete="off"` で人間が触れないようにしている。
 */

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "error"; message: string };

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 700,
  color: "var(--ink)", marginBottom: 7,
};

const fieldStyle: React.CSSProperties = {
  width: "100%", padding: "11px 13px", fontSize: 15,
  color: "var(--ink)", background: "#fff",
  border: "1px solid var(--line)", borderRadius: 9,
  fontFamily: "inherit", lineHeight: 1.6,
};

function Required() {
  return (
    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "var(--royal)" }}>必須</span>
  );
}

export function BusinessContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });

    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(
      ["company", "name", "email", "phone", "message", "website"].map((k) => [k, String(fd.get(k) ?? "")]),
    );

    try {
      const res = await fetch("/api/business/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      /* ⚠️ status を見ずに ok に倒さないこと。429 / 400 / 502 はすべて失敗。 */
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus({
          kind: "error",
          message: typeof data?.error === "string"
            ? data.error
            : "送信に失敗しました。お手数ですが contact@opinio.co.jp まで直接ご連絡ください。",
        });
        return;
      }
      setStatus({ kind: "sent" });
    } catch {
      /* 通信自体が失敗した場合。**ここも成功に倒さない。** */
      setStatus({
        kind: "error",
        message: "通信に失敗しました。電波状況をご確認のうえ、もう一度お試しください。",
      });
    }
  }

  if (status.kind === "sent") {
    return (
      <div
        role="status"
        style={{
          padding: "32px 28px", background: "#fff",
          border: "1.5px solid var(--royal-100)", borderRadius: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
          送信しました
        </h2>
        <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.9, margin: 0 }}>
          ご相談ありがとうございます。内容を確認のうえ、ご入力いただいたメールアドレス宛に
          担当者からご連絡します。
          {/* ⚠️ 返信までの日数を書かないこと。運営の対応時間を約束できる根拠が無い
                 （CLAUDE.md「実データの裏付けが無い主張を書かない」）。 */}
        </p>
      </div>
    );
  }

  const sending = status.kind === "sending";

  return (
    <form onSubmit={handleSubmit} noValidate={false}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        <div>
          <label htmlFor="bc-company" style={labelStyle}>会社名<Required /></label>
          <input id="bc-company" name="company" required maxLength={BUSINESS_CONTACT_LIMITS.company}
            autoComplete="organization" style={fieldStyle} />
        </div>

        <div>
          <label htmlFor="bc-name" style={labelStyle}>お名前<Required /></label>
          <input id="bc-name" name="name" required maxLength={BUSINESS_CONTACT_LIMITS.name}
            autoComplete="name" style={fieldStyle} />
        </div>

        <div>
          <label htmlFor="bc-email" style={labelStyle}>メールアドレス<Required /></label>
          <input id="bc-email" name="email" type="email" required maxLength={BUSINESS_CONTACT_LIMITS.email}
            autoComplete="email" inputMode="email" style={fieldStyle} />
        </div>

        <div>
          <label htmlFor="bc-phone" style={labelStyle}>
            電話番号
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 500, color: "var(--ink-mute)" }}>任意</span>
          </label>
          <input id="bc-phone" name="phone" type="tel" maxLength={BUSINESS_CONTACT_LIMITS.phone}
            autoComplete="tel" inputMode="tel" style={fieldStyle} />
          {/* ⚠️ この一文は事実。/business の FAQ にも「営業電話はかかってきません」と
                 書いてあり、**片方だけ直さないこと。** */}
          <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7, margin: "7px 0 0" }}>
            こちらから営業のお電話をすることはありません。
          </p>
        </div>

        <div>
          <label htmlFor="bc-message" style={labelStyle}>ご相談内容<Required /></label>
          <textarea id="bc-message" name="message" required rows={6}
            maxLength={BUSINESS_CONTACT_LIMITS.message}
            placeholder="採用でお困りのこと、お知りになりたいことをご記入ください。"
            style={{ ...fieldStyle, resize: "vertical" }} />
        </div>

        {/* ハニーポット。⚠️ 消さないこと（理由はファイル冒頭）
            ⚠️ 中身にも幅を与えている。既定幅のままだと親（1px）をはみ出し、
               「親幅超え要素」を数える検査に**偽陽性として出続ける**
               （overflow:hidden なので実害は無いが、毎回調べ直すことになる）。 */}
        <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor="bc-website" style={{ display: "block", width: 1, overflow: "hidden" }}>
            こちらは入力しないでください
          </label>
          <input id="bc-website" name="website" tabIndex={-1} autoComplete="off" style={{ width: 1 }} />
        </div>

        {status.kind === "error" && (
          <div
            role="alert"
            style={{
              padding: "14px 16px", borderRadius: 10,
              background: "var(--error-soft)",
              border: "1px solid var(--error)",
              fontSize: 14, color: "var(--ink)", lineHeight: 1.8,
            }}
          >
            {status.message}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={sending}
            className="btn-fixed-size"
            style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "15px 40px", borderRadius: 10, border: "none",
              background: "var(--royal)", color: "#fff",
              fontSize: 15, fontWeight: 700, fontFamily: "inherit",
              cursor: sending ? "default" : "pointer",
              opacity: sending ? 0.6 : 1,
              boxShadow: "0 4px 16px rgba(0,35,102,0.22)",
            }}
          >
            {sending ? "送信中..." : "送信する"}
          </button>
        </div>

        <p style={{ fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.8, margin: 0 }}>
          ご入力いただいた内容は、お問い合わせへの回答のためにのみ使用します。
        </p>

      </div>
    </form>
  );
}
