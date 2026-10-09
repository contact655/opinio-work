import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "権限がありません | OPINIO" }, robots: { index: false, follow: false } };

/**
 * ★/admin を運営でないアカウントで開いたときの画面（2026-10-10）。
 * middleware が 403（判定できなかったときは 503）でここへ書き換える。
 * ⚠️ 文言は admin/layout.tsx の「この画面は運営メンバーだけが開けます」と同じ。管理画面の中身は出さない。
 */
export default async function NoAdminAccessPage() {
  const { data: { user } } = await createClient().auth.getUser();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#f0f4f8" }}>
      <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 16, border: "1px solid var(--line)", padding: 32 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>この画面は運営メンバーだけが開けます</h1>
        <p style={{ margin: "12px 0 0", fontSize: 13.5, lineHeight: 1.9, color: "var(--ink-soft)" }}>
          {user?.email ? <>いま <strong style={{ color: "var(--ink)" }}>{user.email}</strong> でログインしています。</> : null}
          このアカウントには管理画面の権限がありません。
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
          <Link href="/auth?next=%2Fadmin" style={{ display: "inline-flex", alignItems: "center", padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "var(--royal)", color: "#fff", textDecoration: "none" }}>
            別のアカウントでログイン
          </Link>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", padding: "11px 20px", borderRadius: 10, fontSize: 13, fontWeight: 700, background: "#fff", color: "var(--royal)", border: "1px solid var(--royal-100)", textDecoration: "none" }}>
            トップへ
          </Link>
        </div>
      </div>
    </div>
  );
}
