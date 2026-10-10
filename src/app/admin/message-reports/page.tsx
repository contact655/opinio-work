import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "メッセージリクエストの報告 | OPINIO 運営" },
};

/**
 * ★届いたメッセージリクエスト（個人から）を、受け取った人が「運営に報告」した記録（2026-10-11 / 最小限）。
 * ⚠️ 表は ow_message_reports（RLS 有効・ポリシー0本・クライアントに GRANT なし）。admin で読む。
 * ⚠️ 本文は報告した時点の控え（message_snapshot）。会話が消えても読める。
 * ⚠️ 対応の記録（resolved_at）を付ける操作はまだ無い。見る画面だけ。
 * ⚠️★is_test を隠さない（ラベルで区別だけ示す。/admin/member-reports と同じ方針）。
 */
export default async function MessageReportsPage() {
  const admin = createAdminClient();
  const { data: reports, error } = await admin
    .from("ow_message_reports")
    .select("id, conversation_id, reporter_user_id, reported_user_id, message_snapshot, note, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) console.error("[admin/message-reports]", error.message);

  const ids = Array.from(new Set((reports ?? []).flatMap((r) => [r.reporter_user_id as string, r.reported_user_id as string | null]).filter(Boolean) as string[]));
  const users = new Map<string, { name: string; isTest: boolean }>();
  if (ids.length > 0) {
    const { data: us, error: uErr } = await admin.from("ow_users").select("id, name, is_test").in("id", ids);
    if (uErr) console.error("[admin/message-reports] ow_users:", uErr.message);
    for (const u of us ?? []) users.set(u.id as string, { name: (u.name as string) || "名前未設定", isTest: u.is_test === true });
  }
  const who = (id: string | null) => {
    if (!id) return "（退会済み）";
    const u = users.get(id);
    if (!u) return "（不明）";
    return u.isTest ? `${u.name}（検証用アカウント）` : u.name;
  };
  const fmt = (iso: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>メッセージリクエストの報告</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 16px", lineHeight: 1.8 }}>
        個人から届いたメッセージリクエストを、受け取った人が「運営に報告」したものです。新しい順。報告したことは送った人には伝わっていません。
      </p>
      {error ? (
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--error)" }}>取得に失敗しました（0件という意味ではありません）。</p>
      ) : (reports ?? []).length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-mute)" }}>報告はありません。</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {(reports ?? []).map((r) => (
            <section key={r.id as string} data-report-id={r.id as string} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 12.5, color: "var(--ink-mute)", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>{fmt(r.created_at as string)}</span>
                <span>報告した人：{who(r.reporter_user_id as string)}</span>
                <span>送った人：{r.reported_user_id ? <Link href={`/u/${r.reported_user_id as string}`} target="_blank">{who(r.reported_user_id as string)}</Link> : who(null)}</span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.8, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{(r.message_snapshot as string | null) ?? "（本文の控えなし）"}</p>
              {r.note && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--ink-soft)" }}>報告した人のメモ：{r.note as string}</p>}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
