"use client";

import Link from "next/link";
import type { PublicFace } from "@/lib/admin/publicFaces";

/**
 * ⚠️ **`faces === null` を「0人」と描かない。** 取得に失敗しただけなのに
 *    「誰も出ていない」と読めると、壊れているのに正常に見える
 *    （CLAUDE.md「403 は『0件』として静かに素通りする」／`/admin/companies` の要対応と同じ扱い）。
 */
export function PublicFacesClient({ faces }: { faces: PublicFace[] | null }) {
  const suspicious = (faces ?? []).filter(
    (f) => f.isTest || (f.email ?? "").includes("@opinio.co.jp"),
  );

  return (
    <div style={{ padding: 24, maxWidth: 1060 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>
        公開面に出ている人
      </h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, marginBottom: 16 }}>
        企業ページ（現役社員・OB/OG・面談対応者）と <code>/people</code> に、
        <strong>いま実際に出ている人</strong>の一覧です。判定は公開ページと同じ関数を通しています。
        <br />
        <strong>見覚えのないアカウントが無いかを、メールと登録日で確かめてください。</strong>
      </p>

      {faces === null ? (
        <div style={{
          padding: "12px 14px", borderRadius: 8, marginBottom: 16,
          background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
          fontSize: 13, lineHeight: 1.7,
        }}>
          取得に失敗しました。<strong>この一覧は表示できていません（0人という意味ではありません）。</strong>
        </div>
      ) : (
        <>
          {suspicious.length > 0 && (
            <div style={{
              padding: "12px 14px", borderRadius: 8, marginBottom: 16,
              background: "#FEF3C7", border: "1px solid #FDE68A", color: "var(--warm-ink)",
              fontSize: 13, lineHeight: 1.7,
            }}>
              <strong>要確認 {suspicious.length}名</strong> — 社内ドメイン（<code>@opinio.co.jp</code>）
              または <code>is_test</code> のアカウントが公開面に出ています。
              <br />
              ⚠️ 実在の社内メンバーなら正常です。<strong>検証用アカウントなら <code>is_test</code> を立ててください。</strong>
              2026-08-26 に、フラグの立っていない検証用アカウント3件が企業ページに出ていました。
            </div>
          )}

          <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 8 }}>
            全 <strong>{faces.length}</strong> 名
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--line)", textAlign: "left" }}>
                  <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>名前</th>
                  <th style={{ padding: "8px 10px" }}>メール</th>
                  <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>登録日</th>
                  <th style={{ padding: "8px 10px" }}>出ている場所</th>
                </tr>
              </thead>
              <tbody>
                {faces.map((f) => {
                  const flagged = f.isTest || (f.email ?? "").includes("@opinio.co.jp");
                  return (
                    <tr key={f.userId} style={{
                      borderBottom: "1px solid var(--line-soft)",
                      background: flagged ? "#FFFBEB" : undefined,
                    }}>
                      {/* ⚠️ 名前を折り返さない。長い「出ている場所」に押されて
                             **縦書きになった**（2026-08-26 に実際にそうなった） */}
                      <td style={{ padding: "8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>
                        <Link href={`/u/${f.userId}`} style={{ color: "var(--royal)", textDecoration: "none" }}>
                          {f.name}
                        </Link>
                        {f.isTest && (
                          <span style={{
                            marginLeft: 6, fontSize: 11, fontWeight: 700, color: "var(--warm-ink)",
                            background: "#FEF3C7", border: "1px solid #FDE68A",
                            borderRadius: 4, padding: "1px 5px",
                          }}>
                            is_test
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--ink-soft)", fontFamily: "var(--font-inter), var(--font-noto)", whiteSpace: "nowrap" }}>
                        {/* ★メールで「ユーザー管理」を絞り込んで開く（2026-09-09 / 柴さんの指示）。
                            ⚠️★**2つの画面は別の問いに答える。統合しない。**
                               こちらは「訪問者に実際に見えている人は誰か」（監査）、
                               `/admin/candidates` は「登録している人は誰か」（台帳）。
                               1人が最大4か所に出るので台帳に混ぜると読めなくなり、
                               こちらの判定は企業ごとに公開ページと同じ関数を呼ぶループなので
                               台帳側に載せると毎回重くなる。**行き来だけを足す。**
                            ⚠️ メールで絞る（`?q=`）。**id では絞れない**——検索は
                               name / email / location にしか当たらない。
                            ⚠️ メールが無い行はリンクにしない（絞り込めないので、
                               押すと全件が出て「探せた」と誤解する）。 */}
                        {f.email ? (
                          <Link
                            href={`/admin/candidates?q=${encodeURIComponent(f.email)}`}
                            title="ユーザー管理でこの人を開く"
                            style={{ color: "var(--ink-soft)", textDecoration: "none", borderBottom: "1px dotted var(--line)" }}
                          >
                            {f.email}
                          </Link>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--ink-mute)", whiteSpace: "nowrap", fontFamily: "var(--font-inter), var(--font-noto)" }}>
                        {f.createdAt ? f.createdAt.slice(0, 10) : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", color: "var(--ink-soft)", lineHeight: 1.6 }}>
                        {/* ⚠️ 1つずつは折り返さないが、**列としては折り返す**。
                               nowrap のままだと名前の列が潰れる */}
                        {f.places.map((p, i) => (
                          <span key={i} style={{ whiteSpace: "nowrap", marginRight: 4 }}>
                            {p.where}（{p.as}）{i < f.places.length - 1 ? " /" : ""}
                          </span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {faces.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--ink-mute)", padding: "16px 0" }}>
              公開面に出ている人はいません。
            </p>
          )}
        </>
      )}
    </div>
  );
}
