"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { memberState, type MemberState, type CompanyMemberRow } from "@/lib/constants/companyMembers";

/**
 * 「在籍している会社について、話を聞かれてもよいか」（/mypage 右カラム・StanceCard の直下）。
 *
 * ★2026-08-24 に**トグル**にした（柴さんの指示）。ONが「面談可」そのもので、
 *   本人がいつでも切り替えられる。**会社の事前承認は廃止した。**
 *
 * ── 何を持つか ─────────────────────────────────────────────────────────────
 * `ow_company_members` の**行そのもの**。列は増やさない。
 * **状態は `memberState()` の5つをそのまま使う。ここで状態を定義し直さない。**
 *
 * ⚠️★**OFF で行を消さない。** `/api/mypage/ambassador-visibility` を叩いて
 *    `display_consent` と `is_public` を false にするだけ。消すと戻すのが
 *    作り直しになり、「いつでも戻せる」というこの画面の約束が嘘になる。
 *    （DELETE する `ambassador-self-remove` はもうこの画面からは呼ばない）
 *
 * ⚠️★**なりすまし対策は3つで受けている。1つでも外すと成立しない。**
 *    ① 在籍として申告している会社にしか出せない（RLS `member_self_apply` の EXISTS）
 *    ② 企業はいつでも非掲載にできる（`/biz/members`）
 *    ③ **この画面に「本人の申告です。OPINIO は在籍確認をしていません」と出す**
 *    ③を消さないこと。①②はコードで守れるが、③は文言でしか守れない。
 *
 * ⚠️ `unlisted`（企業が非掲載にした）を「本人が承認していない」と読める文言にしない。
 *    本人はONのままで、止めているのは企業側。
 *
 * ⚠️ 「面談」という語を本文に使わない（選考の面談と読まれる）。見出しは
 *    「話を聞かれてもよいか」。トグルのラベルだけ、柴さんの指示で「面談可」を使う。
 */

/** @deprecated 名前だけの別名。実体は `CompanyMemberRow` */
export type TalkMembership = CompanyMemberRow;

/* 状態ごとの1行。**トグルの下に出す“いまどうなっているか”**。
   ⚠️ ここを増やさない。説明はトグルのラベルと下の注記で足りている。 */
const LINE: Record<Exclude<MemberState, "none">, { text: string; tone: string }> = {
  /** 企業に招待されて、まだ一度も応じていない */
  pending_user:    { text: "会社から依頼が届いています", tone: "var(--ink-soft)" },
  /** 本人が自分でOFFにしている。⚠️ 「戻せる」ことを必ず書く */
  paused:          { text: "いまは掲載していません · ONにすればすぐ戻ります", tone: "var(--ink-mute)" },
  /** @deprecated 到達しない（会社の事前承認を廃止した） */
  pending_company: { text: "会社の確認待ち", tone: "var(--ink-soft)" },
  /** ⚠️ 止めているのは企業側。本人が何かを怠っているように読ませない */
  unlisted:        { text: "会社の設定でいまは非掲載です", tone: "var(--ink-soft)" },
  listed:          { text: "話を聞きたい人から連絡が届きます", tone: "var(--success)" },
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
  /* ⚠️ 2026-08-24 に**削除の確認ダイアログをやめた**。OFF は行を消さず掲載を止めるだけで、
        ONに戻せば同じ状態に戻るので、確認で止める理由が無くなった。
        ⚠️ 行ごと消す操作（`ambassador-self-remove`）を**この画面に戻すなら**、
           2段階の確認も一緒に戻すこと。あれは取り消せない。 */
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
          /* ★トグルの見た目は「本人の意思」。掲載されているかは下の行が言う。
             ⚠️ `unlisted`（企業が非掲載）でも**ONのまま**にする。本人はONにしており、
                ここでOFFに見せると「自分で切ったのか会社が切ったのか」が分からなくなる。 */
          const on = state === "listed" || state === "unlisted";

          /* ⚠️ 招待に未応答のときは既存の着地ページへ送る。**新しい承認導線を作らない。**
                依頼の中身（どの会社から・どんな依頼か）を見ないまま承認させないため。 */
          const invitePending = state === "pending_user" && !!m;

          const toggle = () => {
            if (busy) return;
            if (!m) {
              /* 行がまだ無い＝はじめてON。作成と同時に掲載される */
              void run("/api/mypage/ambassador-self-register", {
                method: "POST",
                body: JSON.stringify({ company_id: company.id }),
              }, company.id);
              return;
            }
            void run("/api/mypage/ambassador-visibility", {
              method: "PATCH",
              body: JSON.stringify({ member_id: m.id, enabled: !on }),
            }, m.id);
          };

          return (
            <div key={company.id} style={{
              background: "var(--bg-tint)",
              border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {company.name}
              </div>

              {invitePending ? (
                <a
                  href={`/mypage/ambassador-invite/${m!.invite_token}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "100%", height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700,
                    textDecoration: "none", background: "var(--royal)", color: "#fff", boxSizing: "border-box",
                  }}
                >
                  内容を確認する →
                </a>
              ) : (
                /* ★トグル本体。⚠️ `button` にする（div にすると Tab で届かない）。
                      ⚠️ `aria-pressed` を付ける。見た目だけで状態を伝えない。 */
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${company.name}で面談可にする`}
                  disabled={busy}
                  onClick={toggle}
                  className="btn-fixed-size"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: 12, width: "100%", padding: 0, background: "none", border: "none",
                    cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                    {busy ? "保存中…" : "面談可にする"}
                  </span>
                  <span aria-hidden style={{
                    width: 40, height: 22, borderRadius: 999, flexShrink: 0,
                    background: on ? "var(--royal)" : "var(--line)",
                    display: "inline-flex", alignItems: "center",
                    justifyContent: on ? "flex-end" : "flex-start",
                    padding: 2, transition: "background 0.15s",
                    opacity: busy ? 0.6 : 1,
                  }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff" }} />
                  </span>
                </button>
              )}

              {/* いまどうなっているか。⚠️ 状態ごとに1行だけ */}
              {state !== "none" && (
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: LINE[state].tone }}>
                  {LINE[state].text}
                </p>
              )}
              {state === "none" && (
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
                  ONにすると、この会社のページに掲載されます
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ★なりすまし対策の3つ目（`TalkToMeCard` の冒頭コメント参照）。**消さないこと。**
             ⚠️ 語彙は `/people` の注記と揃える。同じ事実を2つの画面で別々に言わない。 */}
      <p style={{ margin: "12px 0 0", fontSize: 11, lineHeight: 1.7, color: "var(--ink-mute)" }}>
        在籍は本人の申告です。OPINIO は在籍確認を行っていません。会社の判断で非掲載になることがあります。
      </p>

      {error && (
        <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>
      )}
    </section>
  );
}
