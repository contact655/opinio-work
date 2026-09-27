import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { TestLeftoversCard } from "@/components/admin/TestLeftoversCard";
import type { TestLeftovers } from "@/lib/admin/testLeftovers";

/**
 * 検証用アカウントの取り残しカード（`/admin` の要対応タスク）。2026-09-28 追加。
 *
 * ── なぜ要るか ──────────────────────────────────────────────────────────────
 * ⚠️★**実データは0件が正常。** つまり実画面では**出る側を一度も描けない。**
 *    `page.tsx` に直書きのままだと「描いたことがないものを出す」ことになる
 *    （2026-08-30 に求人の OB・OG で実際にやった）。
 * ⚠️★**`is_test` を検証のため一時的に false にしないこと**（CLAUDE.md）。
 *    その瞬間、実在企業のページに検証用アカウントが出る。
 *
 * ── 何を見るか ──────────────────────────────────────────────────────────────
 * ⚠️ **0件のとき何も描かない**こと（「0件です」も出さない）。
 * ⚠️ **取得に失敗したときは出す**こと。文言が「0件という意味ではありません」であること。
 * ⚠️ 件数が多いとき、1行に詰め込んで読めなくなっていないこと。
 */
const none: TestLeftovers = { users: [], companies: [], failed: false };

const one: TestLeftovers = {
  users: ["contact+42@opinio.co.jp"],
  companies: [],
  failed: false,
};

const both: TestLeftovers = {
  users: ["contact+40@opinio.co.jp", "contact+41@opinio.co.jp", "contact+42@opinio.co.jp"],
  companies: [
    { id: "a", name: "株式会社テスト", createdBy: "contact+42@opinio.co.jp" },
    { id: "b", name: "配線確認用カイシャ", createdBy: "contact+40@opinio.co.jp" },
  ],
  failed: false,
};

/** ⚠️ 作成者が引けないことがある（`on delete set null`）。「不明」と出ること */
const unknownCreator: TestLeftovers = {
  users: [],
  companies: [{ id: "c", name: "作成者が消えた会社", createdBy: null }],
  failed: false,
};

const failed: TestLeftovers = { users: [], companies: [], failed: true };

export default function Page() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="is_test の取り残し（/admin の要対応）">
        <p style={{ margin: 0 }}>
          `is_test` を立て忘れた行は、誰にも気づかれずに<strong>実ユーザー・実企業として数えられます</strong>。
          2026-09-14 / 09-17 / 09-28 に<strong>4回</strong>起きており、最後の3回は
          「注意書きを書いた当日に、書いた本人が」踏んでいます。
        </p>
        <p style={{ margin: "8px 0 0" }}>
          <strong>0件が正常です。</strong>だから実画面では出る側を描けません。ここで見ます。
        </p>
      </PreviewHeader>

      <Variant label="0件（正常）" note="★何も描かないこと。「0件です」も出さない">
        <TestLeftoversCard leftovers={none} />
        <p style={{ fontSize: 12, color: "var(--ink-mute)", margin: 0 }}>
          （この下に何も出ていなければ正しい）
        </p>
      </Variant>

      <Variant label="利用者が1件" note="いちばん多い形。メールがそのまま出る">
        <TestLeftoversCard leftovers={one} />
      </Variant>

      <Variant label="利用者3件 + 企業2件" note="2026-09-28 に実際に起きた形。1行に詰まって読めなくなっていないか">
        <TestLeftoversCard leftovers={both} />
      </Variant>

      <Variant label="作成者が引けない企業" note="⚠️「不明」と出ること。空欄にしない（on delete set null で起きる）">
        <TestLeftoversCard leftovers={unknownCreator} />
      </Variant>

      <Variant label="取得に失敗" note="★0件に化けさせない。「0件という意味ではありません」と出ること">
        <TestLeftoversCard leftovers={failed} />
      </Variant>
    </div>
  );
}
