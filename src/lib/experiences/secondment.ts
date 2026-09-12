/**
 * ★出向先の検証（2026-09-12 / 柴さんの指示）。**POST と PUT が同じ関数を通る。**
 *
 * 出向は「籍はA社のまま、働く場所はB社」という状態。
 * **B社の職歴として持たせない**（持たせると出向先の企業ページに社員として出る）。
 * A社の役割に「出向先」を持たせて表す。
 *
 * ⚠️★**`company_id` / `company_text` に混ぜないこと。** 企業ページの社員抽出
 *    （`getCompanyEmployees` と面談対応者の在籍判定）は `company_id` を見ている。
 *    混ぜた瞬間に出向先の企業ページへ社員として出る。
 *
 * ⚠️ **任意。** キーが無ければ列に触らない（`undefined`。`JSON.stringify` が落とす）。
 *    ⚠️ **`?? null` に倒さない。** 送らない更新のたびに出向先が消える。
 *    空文字・null を明示で送ったときだけ「外した」として null を書く。
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SecondmentPatch = {
  secondment_company_id?: string | null;
  secondment_company_text?: string | null;
};

export type ParseSecondmentResult =
  | { ok: true; patch: SecondmentPatch }
  | { ok: false; error: string; message: string };

/**
 * @param companyId この役割の**所属会社**の id（自由入力なら null）。自社チェックに使う。
 */
export function parseSecondment(
  body: Record<string, unknown>,
  companyId: string | null,
): ParseSecondmentResult {
  const hasId = "secondment_company_id" in body;
  const hasText = "secondment_company_text" in body;
  /* どちらのキーも無ければ触らない */
  if (!hasId && !hasText) return { ok: true, patch: {} };

  const rawId = body.secondment_company_id;
  const rawText = body.secondment_company_text;
  const idGiven = typeof rawId === "string" && rawId.length > 0;
  const textGiven = typeof rawText === "string" && rawText.trim().length > 0;

  /* ⚠️ 両方は入らない（DB の `experience_secondment_xor` と同じ条件）。
        ここで弾かないと 23514 になり、利用者には原因の分からない 500 に見える。 */
  if (idGiven && textGiven) {
    return { ok: false, error: "INVALID_SECONDMENT", message: "出向先は1つだけ指定してください。" };
  }
  if (idGiven && !UUID_RE.test(rawId as string)) {
    return { ok: false, error: "INVALID_SECONDMENT", message: "出向先の指定が正しくありません。" };
  }
  /* ⚠️★**自社は出向先にできない。** 同じ会社なら出向ではなく異動。
        DB にも同じ CHECK があるが、こちらで弾いて**理由を返す**。 */
  if (idGiven && companyId && rawId === companyId) {
    return {
      ok: false,
      error: "SECONDMENT_IS_SELF",
      message: "出向先に自社は選べません。同じ会社の中での異動は、出向先を空のまま追加してください。",
    };
  }

  return {
    ok: true,
    patch: {
      secondment_company_id: idGiven ? (rawId as string) : null,
      secondment_company_text: textGiven ? (rawText as string).trim().slice(0, 200) : null,
    },
  };
}
