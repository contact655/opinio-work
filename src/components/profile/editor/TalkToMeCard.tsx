"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { memberState, type MemberState, type CompanyMemberRow } from "@/lib/constants/companyMembers";
/* ⚠️ 会社名は必ずここを通す（2026-08-25）。法人格（株式会社…）と末尾の " Japan" が落ちる。
      ⚠️ 正規表現をコピーして持ってこないこと。3箇所に割れていたのを集約した経緯がある。 */
import { companyDisplayName } from "@/lib/companies/displayName";

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
 *    （行ごと消す DELETE ルートは 2026-08-24 に削除した。本人側に戻さないこと）
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
  /* ⚠️ 「掲載」とだけ書かない（2026-08-25）。この製品には**会社の掲載・求人の掲載・
        人の掲載**があり、どれの話か読めない。**どのページに出るのか**を書く。 */
  paused:          { text: "この会社のページに出ていません · ONで戻ります", tone: "var(--ink-mute)" },
  /** @deprecated 到達しない（会社の事前承認を廃止した） */
  pending_company: { text: "会社の確認待ち", tone: "var(--ink-soft)" },
  /** ⚠️ 止めているのは企業側。本人が何かを怠っているように読ませない */
  unlisted:        { text: "会社の設定で、いまはページに出ていません", tone: "var(--ink-soft)" },
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
        ⚠️ 行ごと消す操作を**この画面に戻すなら**、2段階の確認も一緒に戻すこと。
           あれは取り消せない（企業の確認からやり直しになる）。 */
  const [error, setError] = useState<string | null>(null);

  /* 在籍している会社と、その会社の行（あれば）を突き合わせる。
     ⚠️ 行があるが在籍申告が無い会社（退職済みなど）も**出す**。
        出さないと、行が残っているのに本人が始末できなくなる。
     ★`isCurrent` を持たせる（2026-08-25）。「話を聞ける人」は**現職についての話**なので、
       在籍が切れた行は掲載されない（公開側は `talkable.ts` / `getPublicAmbassadorsCached`
       が `is_current = true` を要求している）。
       ⚠️ **なのにこの画面は `is_public` だけを見て「掲載中」と言っていた。**
          公開側は既に降ろしているので、**画面だけが嘘をついている**状態だった。 */
  const byCompany = new Map(memberships.map((m) => [m.company_id, m]));
  const rows = [
    ...currentCompanies.map((c) => ({ company: c, m: byCompany.get(c.id) ?? null, isCurrent: true })),
    ...memberships
      .filter((m) => !currentCompanies.some((c) => c.id === m.company_id))
      .map((m) => ({ company: { id: m.company_id, name: m.company_name }, m, isCurrent: false })),
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
      {/* ★見出しで「誰が・何を聞くのか」まで言い切る（2026-08-25）。
             以前は「話を聞かれてもよいか」だけで、**何の話か**が読めなかった。
          ⚠️ 「面談」という語は使わない（選考の面談と読まれる）。 */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.04em", marginBottom: 2 }}>
        いま在籍している会社について
      </div>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "0 0 4px" }}>
        転職を考えている人と話せますか
      </h2>
      <p style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
        仕事の内容や社内の様子について、聞かれる側になります。
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ company, m, isCurrent }) => {
          const state = memberState(m);
          const busy = busyId === (m?.id ?? company.id);
          /* ⚠️ 表示にも読み上げにも同じ名前を使う。法人格と " Japan" が落ちる */
          const brand = companyDisplayName(company.name, null).displayName;
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
              {/* ⚠️ ブランド名で出す。`株式会社セールスフォース・ジャパン` は
                     カード幅（約254px）で必ず省略記号になり、どの会社か読めなかった。
                     ⚠️ `title` に正式名称を残す（省略しても確認できるように）。 */}
              <div
                title={company.name}
                style={{
                  fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {brand}
              </div>

              {/* ★在籍が切れている行（2026-08-25）。
                     ⚠️ **トグルを出さない。** ONにしても RLS（在籍チェック）に弾かれるし、
                        そもそも「話を聞ける人」は現職についての話なので、ONにする意味が無い。
                     ⚠️ 行は残っているので、本人が始末できる導線だけ出す。
                        OFF にする更新は在籍が切れていても通る（RLS は公開する側にだけ
                        在籍チェックを掛けてある）。 */}
              {!isCurrent ? (
                <>
                  <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
                    この会社の在籍が職歴にありません。
                    <strong style={{ color: "var(--ink-soft)" }}>この会社のページには出ていません。</strong>
                  </p>
                  {m && (m.is_public || m.display_consent) && (
                    <button
                      type="button"
                      className="btn-fixed-size"
                      disabled={busy}
                      onClick={() => void run("/api/mypage/ambassador-visibility", {
                        method: "PATCH",
                        body: JSON.stringify({ member_id: m.id, enabled: false }),
                      }, m.id)}
                      style={{
                        width: "100%", height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600,
                        fontFamily: "inherit", cursor: busy ? "wait" : "pointer",
                        border: "1px solid var(--line)", background: "#fff", color: "var(--ink-soft)",
                      }}
                    >
                      {busy ? "処理中…" : "登録を残さない"}
                    </button>
                  )}
                </>
              ) : invitePending ? (
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
                  /* ⚠️ 読み上げの文言も画面と合わせる（2026-08-25）。
                        正式名称のままだと「株式会社…ジャパンで面談可にする」と読まれ、
                        画面に見えている「話を聞かれてもよい」と一致しなかった。 */
                  aria-label={`${brand}について話を聞かれてもよい`}
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
                    {busy ? "保存中…" : "話を聞かれてもよい"}
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

              {/* いまどうなっているか。⚠️ 状態ごとに1行だけ。
                     ⚠️ 在籍が切れている行では出さない（上で「掲載されていません」と言っている）。 */}
              {isCurrent && state !== "none" && (
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: LINE[state].tone }}>
                  {LINE[state].text}
                </p>
              )}
              {state === "none" && (
                <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.6, color: "var(--ink-mute)" }}>
                  ONにすると、この会社のページに「話を聞ける人」として出ます
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ★なりすまし対策の3つ目（`TalkToMeCard` の冒頭コメント参照）。**消さないこと。**
             ⚠️ 語彙は `/people` の注記と揃える。同じ事実を2つの画面で別々に言わない。 */}
      <p style={{ margin: "12px 0 0", fontSize: 11, lineHeight: 1.7, color: "var(--ink-mute)" }}>
        在籍は自己申告で、OPINIO は確認していません。会社の判断で出ないこともあります。
      </p>

      {error && (
        <p style={{ margin: "10px 0 0", fontSize: 12, fontWeight: 600, color: "var(--error)" }}>{error}</p>
      )}
    </section>
  );
}
