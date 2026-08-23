"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { memberState, type MemberState, type CompanyMemberRow } from "@/lib/constants/companyMembers";

/**
 * 「在籍している会社について、話を聞かれてもよいか」（/mypage 右カラム・StanceCard の直下）。
 *
 * ── 何を持つか ─────────────────────────────────────────────────────────────
 * `ow_company_members` の**行そのもの**。列は増やさない。
 * **状態は `memberState()` の5つをそのまま使う。ここで状態を定義し直さない。**
 *
 * ⚠️★**本人は「申請」までしか作れない。** 公開するのは企業側（`is_public`）。
 *    `ow_experiences` の在籍は自己申告なので、即公開にすると誰でも
 *    「セールスフォース在籍」と書いて企業ページに実名・顔写真つきで並べられる。
 *    API（`/api/mypage/ambassador-self-register`）も RLS（`member_self_apply`）も
 *    `is_public=false` を強制している。**ここから公開できる導線を作らないこと。**
 *
 * ⚠️★**`pending_company` を「公開中」に見せない。**
 *    `display_consent` だけで色分けすると、申請しただけの人に「公開中」と出る。
 *    実際 2026-08-23 まで `/mypage` 本文の旧ウィジェットがそうなっていた。
 *
 * ⚠️★**`unlisted` を「本人が承認していない」と読める文言にしない。**
 *    本人は同意済みで、非公開にしているのは企業側。待たされているのは本人ではない。
 *
 * ⚠️ 挙動は `StanceCard` に合わせる。**API 方式・楽観更新なし**
 *    （押した瞬間ではなく、保存できてから表示を変える）。
 *    未選択でどちらのボタンも active にしない。
 */

/** @deprecated 名前だけの別名。実体は `CompanyMemberRow` */
export type TalkMembership = CompanyMemberRow;

/* ⚠️ 文言は**案**。確定は柴さん。ここを唯一の置き場にして、状態ごとに1箇所で持つ。
      ⚠️ 「面談」という語を本文に使わない（選考の面談と読まれる）。
         見出しも「話を聞かれてもよいか」にしてある。 */
const COPY: Record<Exclude<MemberState, "none">, { badge: string; tone: string; line: string }> = {
  pending_user: {
    badge: "あなたの確認待ち",
    tone: "var(--warm-soft)",
    line: "この会社から「話せる人」として登録の依頼が届いています。内容を確認してください。",
  },
  pending_company: {
    badge: "会社の確認待ち",
    tone: "var(--warm-soft)",
    line: "申請しました。会社が在籍を確認すると、この会社のページに掲載されます。まだ公開されていません。",
  },
  unlisted: {
    badge: "いまは非掲載",
    tone: "var(--bg-tint)",
    line: "会社側の設定で、いまはページに掲載されていません。あなたの登録はそのまま残っています。",
  },
  listed: {
    badge: "掲載中",
    tone: "var(--success-soft)",
    line: "この会社のページに掲載されています。話を聞きたい人から連絡が届きます。",
  },
};

export default function TalkToMeCard({
  currentCompanies,
  memberships,
}: {
  /** 在籍中かつ企業マスタに紐づく会社。**0件ならカードごと出さない**
   *
   * ⚠️ 在籍先が自由入力の人（2026-08-23 時点で実ユーザー11人中**5人**）には
   *    このカードごと出ない。`ow_company_members.company_id` が `ow_companies` への
   *    FK なので、企業マスタに無い会社では行を作れないため。
   *    ⚠️ **理由を画面に出す案（「登録されていないため使えません」）は採らなかった。**
   *       利用者側では直せず、案内先が無いと徒労になる。
   *       対処は「利用者による企業マスタ作成」の検討とセット。 */
  currentCompanies: { id: string; name: string }[];
  memberships: TalkMembership[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  /* ⚠️ 確認は**その行に対して**持つ。カード全体で1つにすると、
        複数社に在籍している人が別の行の確認を開いたまま押せてしまう。 */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* 在籍している会社と、その会社の行（あれば）を突き合わせる。
     ⚠️ 行があるが在籍申告が無い会社（退職済みなど）も**出す**。
        出さないと、公開されたままなのに本人が解除できなくなる。 */
  const byCompany = new Map(memberships.map((m) => [m.company_id, m]));
  const rows = [
    ...currentCompanies.map((c) => ({ company: c, m: byCompany.get(c.id) ?? null })),
    ...memberships
      .filter((m) => !currentCompanies.some((c) => c.id === m.company_id))
      .map((m) => ({ company: { id: m.company_id, name: m.company_name }, m })),
  ];

  if (rows.length === 0) return null;

  async function run(url: string, init: RequestInit, id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.message ?? "保存できませんでした。もう一度お試しください。");
        return;
      }
      /* ⚠️ 楽観更新しない。サーバーの行を取り直してから表示を変える。 */
      setConfirmingId(null);
      router.refresh();
    } catch {
      setError("保存できませんでした。もう一度お試しください。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section style={{
      background: "#fff", border: "1px solid var(--line)", borderRadius: 14,
      padding: "18px 18px 16px", boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em", marginBottom: 2 }}>
        いま在籍している会社について
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
        話を聞かれてもよいか
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ company, m }) => {
          const state = memberState(m);
          const busy = busyId === (m?.id ?? company.id);

          return (
            <div key={company.id} style={{
              background: state === "none" ? "var(--bg-tint)" : COPY[state].tone,
              border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", flex: 1, minWidth: 0,
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {company.name}
                </span>
                {state !== "none" && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)",
                                 background: "#fff", border: "1px solid var(--line)",
                                 borderRadius: 100, padding: "2px 8px", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {COPY[state].badge}
                  </span>
                )}
              </div>

              {/* ★申請日を出す（2026-08-23）。
                     ⚠️ 出さないと「いつ申請したか」が本人に分からず、
                        止まっているのか忘れられているのかを区別できない。
                     ⚠️ 「運営が確認します」とは書かない。宛先がある企業では企業が承認するので、
                        全員に出すと事実と違う。 */}
              {state === "pending_company" && m?.consent_at && (
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)" }}>
                  {new Date(m.consent_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })} に申請
                </p>
              )}
              <p style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
                {state === "none"
                  /* ⚠️ 見送られると行ごと消えて `none` に戻る。**却下は記録されない**ので、
                        本人には「申請が消えた」ようにしか見えない。だから
                        「また申請できる」ことを**申請できる状態のときに常時**書いておく。
                        ⚠️ 「取り下げ」とは書かない。初めて見る人には何を指すか分からない。 */
                  ? "この会社について話を聞きたい人がいたら、つないでもよいですか。会社が在籍を確認してから掲載されます。会社の判断で見送られることもありますが、あとから申請し直せます。"
                  : COPY[state].line}
              </p>

              {/* ── 状態ごとの操作 ───────────────────────────────────────── */}
              {state === "none" && (
                /* ⚠️ 「はい／いいえ」の2択にしない。**「いいえ」は行を作らない**ことなので、
                      押さないことがそのまま「いいえ」。未選択でどちらも active にしないのと同じ考え方。 */
                <button
                  type="button"
                  className="btn-fixed-size"
                  disabled={busy}
                  onClick={() => run("/api/mypage/ambassador-self-register", {
                    method: "POST",
                    body: JSON.stringify({ company_id: company.id }),
                  }, company.id)}
                  style={{
                    width: "100%", height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700,
                    fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                    border: "1.5px solid var(--royal)", background: "var(--royal)", color: "#fff",
                  }}
                >
                  {busy ? "送信中…" : "申請する"}
                </button>
              )}

              {state === "pending_user" && m && (
                /* ⚠️ 新しい承認導線を作らない。既存の着地ページへ送る。 */
                <a
                  href={`/mypage/ambassador-invite/${m.invite_token}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "100%", height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700,
                    textDecoration: "none", background: "var(--royal)", color: "#fff", boxSizing: "border-box",
                  }}
                >
                  内容を確認する →
                </a>
              )}

              {/* ⚠️ 申請の取り消しは**確認を挟まない**。まだ会社の確認を受けていないので、
                     押し直しても失うものが無い（待ち時間だけ）。 */}
              {state === "pending_company" && m && (
                <button
                  type="button"
                  className="btn-fixed-size"
                  disabled={busy}
                  onClick={() => run("/api/mypage/ambassador-self-remove", {
                    method: "DELETE",
                    body: JSON.stringify({ member_id: m.id }),
                  }, m.id)}
                  style={{
                    width: "100%", height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600,
                    fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                    border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                  }}
                >
                  {busy ? "処理中…" : "申請を取り消す"}
                </button>
              )}

              {/* ★掲載中・非掲載の取り消しは**二段階**にする。
                     ⚠️ 実体は行の DELETE で、**一時停止ではない**。戻すには再申請して
                        会社の確認をもう一度受ける必要がある。1クリックで消させない。
                     ⚠️ 「掲載をやめる」とは書かない。`unlisted` では既に非掲載なので
                        意味が通らず、`listed` では一時停止に読める。 */}
              {(state === "unlisted" || state === "listed") && m && (
                confirmingId === m.id ? (
                  <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.6, color: "var(--ink)", fontWeight: 600 }}>
                      登録を取り消すと、もう一度申請して会社の確認を受ける必要があります。
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        className="btn-fixed-size"
                        disabled={busy}
                        onClick={() => run("/api/mypage/ambassador-self-remove", {
                          method: "DELETE",
                          body: JSON.stringify({ member_id: m.id }),
                        }, m.id)}
                        style={{
                          flex: 1, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 700,
                          fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                          border: "1.5px solid var(--error)", background: "var(--error)", color: "#fff",
                        }}
                      >
                        {busy ? "処理中…" : "取り消す"}
                      </button>
                      <button
                        type="button"
                        className="btn-fixed-size"
                        disabled={busy}
                        onClick={() => setConfirmingId(null)}
                        style={{
                          flex: 1, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 600,
                          fontFamily: "inherit", cursor: "pointer",
                          border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                        }}
                      >
                        やめる
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-fixed-size"
                    onClick={() => setConfirmingId(m.id)}
                    style={{
                      width: "100%", height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600,
                      fontFamily: "inherit", cursor: "pointer",
                      border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                    }}
                  >
                    登録を取り消す
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>
      )}
    </section>
  );
}
