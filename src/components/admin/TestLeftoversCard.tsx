import { countTestLeftovers, type TestLeftovers } from "@/lib/admin/testLeftovers";

/**
 * 検証用アカウントの取り残しカード（`/admin` の要対応タスク）。2026-09-28 追加。
 *
 * ⚠️★**0件のときは何も描かない。** 要対応は「0件が正常」なので、
 *    出しっぱなしにすると他の要対応まで読まれなくなる。
 * ⚠️★**取得に失敗したときは出す**（`countTestLeftovers` が失敗を1件と数える）。
 *    0に倒すと、壊れているのに要対応が消える。
 * ⚠️★**判定は [lib/admin/testLeftovers.ts](src/lib/admin/testLeftovers.ts) の1箇所。**
 *    日次 cron（`/api/cron/check-test-leftovers`）が同じ関数を呼ぶ。
 *    **ここに条件を書き写さないこと。**
 *
 * ⚠️★**部品にしてあるのは `/dev/preview` で見るため。** 実データは0件が正常なので、
 *    `page.tsx` に直書きすると**出る側を一度も描かないまま出す**ことになる
 *    （2026-08-30 に求人の OB・OG で実際にやった）。
 *    ⚠️ `is_test` を検証のため一時的に false にするのは**禁止**（CLAUDE.md）。
 */
export function TestLeftoversCard({ leftovers }: { leftovers: TestLeftovers }) {
  if (countTestLeftovers(leftovers) === 0) return null;
  return (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 10,
              background: "#FFFBEB", border: "1px solid #FDE68A",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: "#FEF3C7", color: "var(--warm-ink)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--warm-ink)", margin: 0, marginBottom: 2 }}>
                  {leftovers.failed
                    ? "検証用アカウントの判定に失敗しました（0件という意味ではありません）"
                    : `is_test を立て忘れている行 ${leftovers.users.length + leftovers.companies.length}件`}
                </p>
                <p style={{ fontSize: 11, color: "var(--warm-ink)", margin: 0 }}>
                  {leftovers.failed
                    ? "取得に失敗しています"
                    : [
                        ...leftovers.users,
                        ...leftovers.companies.map((c) => `${c.name}（${c.createdBy ?? "作成者不明"}）`),
                      ].join(" ・ ")}
                </p>
              </div>
            </div>
  );
}
