"use client";

import { useEffect, useState } from "react";
import type { PublicAmbassador } from "@/lib/supabase/queries";

/**
 * サイドバーの「💬 カジュアル面談OK」ウィジェット。
 *
 * ── なぜクライアント側なのか ────────────────────────────────────────────────
 * 面談対応者は実ユーザーが全員 `login_only` なので、**未ログインに顔と名前を出してはいけない**。
 * ところが `/companies/[id]` は `export const revalidate = 60` ＋ `generateStaticParams` の
 * **ISR ページ**で、サーバー側で `auth.getUser()` を読むと動的化してキャッシュが効かなくなる
 * （2026-08-09 に社員一覧をここから追い出したのと同じ理由。page.tsx にも
 *  「ここに `createClient()` や `auth.getUser()` を足さないこと」と書いてある）。
 *
 * → **数字だけサーバーで出し、人物はクライアントで出す。**
 *   閲覧者ごとの絞り込みは `/api/jobseeker/companies/[id]/employees`（`force-dynamic`）が行う。
 *   社員一覧と同じ経路・同じ条件なので、片方だけズレることがない。
 *
 * ⚠️ **初期表示は「未ログインの人に見せてよいもの」でなければならない。**
 *    ISR が焼く HTML はこの初期状態そのもので、それが全員に配られる。
 *    `publicAmbassadors` には `visibility === "public"` の人しか入っていない
 *    （＝現状は常に空）。ここに全員を渡すと、**その瞬間に静的HTMLへ名前が焼き付く。**
 *
 * ⚠️ 件数（`totalCount`）は閲覧者に依らないので、サーバーから渡してよい。
 *    「N名が対応可能」も「ログインするとN名」も**この同じ値**から作る。
 *    別々に数えると、過去に出した「現役社員（0名）」と
 *    「ログインすると1名のプロフィールが見られます」が同じ画面に並ぶ事故になる。
 */
export default function AmbassadorWidget({
  companyId,
  publicAmbassadors,
  totalCount,
}: {
  companyId: string;
  /** ⚠️ 未ログインに見せてよい人だけ（`visibility === "public"`）。ISR の HTML に焼かれる */
  publicAmbassadors: PublicAmbassador[];
  /** 閲覧者に依らない総数。見出しと遮蔽メッセージの両方がこの値を使う */
  totalCount: number;
}) {
  const [shown, setShown] = useState<PublicAmbassador[]>(publicAmbassadors);

  useEffect(() => {
    let alive = true;
    fetch(`/api/jobseeker/companies/${companyId}/employees`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        /* ⚠️ `?? []` で握り潰さない。API が形を変えたら気づけるようにする。 */
        if (!Array.isArray(d.ambassadors)) {
          console.error("[AmbassadorWidget] ambassadors が配列ではない", d?.ambassadors);
          return;
        }
        setShown(d.ambassadors as PublicAmbassador[]);
      })
      .catch((e) => console.error("[AmbassadorWidget]", e));
    return () => { alive = false; };
  }, [companyId]);

  // 対応者が1人もいない企業ではウィジェットごと出さない（従来どおり）
  if (totalCount === 0) return null;

  const locked = shown.length === 0;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #FCD34D",
      borderRadius: 14,
      padding: "16px",
      boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
        💬 カジュアル面談OK
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 10 }}>
        {locked ? (
          /* ⚠️ 「0名」ではなく「見えていない」ことを示す。空状態と区別する。 */
          <span aria-hidden style={{
            width: 34, height: 34, borderRadius: "50%", background: "var(--bg-tint)",
            border: "1px solid var(--line)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 15, flexShrink: 0,
          }}>🔐</span>
        ) : (
          shown.slice(0, 5).map((amb, i) => {
            const name = amb.ow_users?.name ?? "";
            const avatarUrl = amb.ow_users?.avatar_url ?? null;
            const avatarColor = amb.ow_users?.avatar_color ?? null;
            return (
              <a key={amb.id} href={`/u/${amb.user_id}`}
                style={{ display: "block", marginLeft: i === 0 ? 0 : -8, position: "relative", zIndex: 5 - i, flexShrink: 0 }}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={name} style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "2px solid #fff" }} />
                ) : (
                  <div style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: avatarColor || "linear-gradient(135deg,var(--royal),#3B5FD9)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#fff", border: "2px solid #fff",
                  }}>
                    {name.charAt(0)}
                  </div>
                )}
              </a>
            );
          })
        )}
        {/* ⚠️ 見出しの N は locked かどうかに関わらず totalCount。数字は隠さない（案A） */}
        <span style={{ marginLeft: 10, fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>
          {totalCount}名が対応可能
        </span>
      </div>

      {locked ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 10, lineHeight: 1.6 }}>
            ログインすると{totalCount}名のプロフィールが見られます
          </div>
          <a href="/auth" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", padding: "9px 0", borderRadius: 8,
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            background: "var(--royal)", color: "#fff", boxSizing: "border-box",
          }}>
            ログイン / 会員登録 →
          </a>
        </>
      ) : (
        <>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-mute)", marginBottom: 10, lineHeight: 1.6 }}>
            選考なし・完全無料。この会社のことを直接聞けます。<br />転職意欲がなくてもOK。
          </div>
          <a href="#current-employees" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "100%", padding: "9px 0", borderRadius: 8,
            fontSize: 12, fontWeight: 700, textDecoration: "none",
            background: "var(--warm)", color: "#fff", boxSizing: "border-box",
          }}>
            カジュアル面談を申し込む →
          </a>
        </>
      )}
    </div>
  );
}
