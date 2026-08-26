import Link from "next/link";
import Image from "next/image";
import type { PersonHit } from "@/lib/search/runSearch";
import { chipStyle } from "@/lib/utils/chipVariant";

/**
 * `/search` の人カード。**`/people` のカードを流用していない。**
 *
 * ⚠️ 理由: `/people` のカードは「現職1件」を前提に作ってあるが、
 *    `/search` は**全職歴**を対象にする。現職だけを出すと
 *    「営業で引いたのにカードはコーポレート」というズレが起きる。
 *    そのズレは `matchReason`（「◯◯ → フィールドセールス」）の1行で解消する。
 *    **この1行を消さないこと。** 消すと、なぜこの人が出たのか分からないカードになる。
 *
 * ⚠️ 年齢は出さない（CLAUDE.md「一覧に年齢を出さない・年齢で絞り込ませない」）。
 *    `PersonHit` の型にも入れていないので、そもそも書けない。
 */
export function PersonHitCard({ person }: { person: PersonHit }) {
  return (
    <Link
      href={`/u/${person.userId}`}
      style={{
        display: "flex", gap: 12, alignItems: "flex-start",
        padding: 14, borderRadius: 12, border: "1px solid var(--line)",
        background: "#fff", textDecoration: "none", color: "inherit",
      }}
    >
      {person.avatarUrl ? (
        <Image
          src={person.avatarUrl} alt="" width={44} height={44}
          style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: person.gradient, color: "#fff", fontWeight: 700,
            display: "grid", placeItems: "center", fontSize: 17,
          }}
        >
          {person.initial}
        </span>
      )}
      <span style={{ minWidth: 0, display: "block" }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
          {person.name}
        </span>
        {/* 現在の所属。visibility_company が hidden なら null が来るので行ごと出さない */}
        {person.currentLabel && (
          <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", marginTop: 2 }}>
            {person.currentLabel}
          </span>
        )}
        {/* ★なぜマッチしたか。全職歴を見ているので、この1行が無いと理由が分からない */}
        {/* ⚠️ 色は neutral 固定（chipVariant.ts）。オレンジは面談専用、緑は金銭条件専用 */}
        {person.matchReason && (
          <span
            /* ⚠️ 省略記号で切るときは title で全文を読めるようにする（.claude/rules/ui-debugging.md） */
            title={person.matchReason}
            style={{
              display: "inline-block", marginTop: 6, padding: "3px 9px",
              borderRadius: 100,
              background: chipStyle("neutral").bg,
              color: chipStyle("neutral").color,
              border: `1px solid ${chipStyle("neutral").border}`,
              fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
            }}
          >
            {person.matchReason}
          </span>
        )}
      </span>
    </Link>
  );
}
