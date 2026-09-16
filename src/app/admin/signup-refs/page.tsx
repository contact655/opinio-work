import { getSignupRefFunnel } from "@/lib/admin/signupRefFunnel";
import { SIGNUP_REF_MAX_LENGTH } from "@/lib/constants/signupRef";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "登録経路 | OPINIO Admin" } };

/*
 * 声かけごとの `?ref=` から、何人が登録して経歴まで入れたかを見る。
 *
 * ⚠️★**判定は `lib/admin/signupRefFunnel.ts` に置いてある。ここに書き写さないこと。**
 *    とくに「企業ページで見える」は `getCompanyEmployees` の除外条件と揃える必要がある。
 *
 * ⚠️★**注意書き（個人を特定できる情報を入れない）を消さないこと。**
 *    ref は自由文字列なので、**コードでは守れない**。運用で守るしかない。
 *    形式の制約（小文字英数）はメールのローカル部を弾かない。
 *
 * ⚠️ 取得に失敗したら「0件」と表示しない（CLAUDE.md「403 は 0件 として静かに素通りする」）。
 */

const TH: React.CSSProperties = {
  textAlign: "left", fontSize: 12, fontWeight: 700, color: "#475569",
  padding: "8px 12px", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  fontSize: 13, color: "#0F172A", padding: "10px 12px", borderBottom: "1px solid #F1F5F9",
};
const NUM: React.CSSProperties = { ...TD, textAlign: "right", fontVariantNumeric: "tabular-nums" };

export default async function AdminSignupRefsPage() {
  const rows = await getSignupRefFunnel();

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>登録経路</h1>
      <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.8, marginBottom: 16 }}>
        声かけごとに URL を分けると、そこから何人が登録して経歴まで入れたかが分かります。
      </p>

      {/* ★運用の注意。⚠️ コードでは守れないので、ここに出す。消さないこと。 */}
      <div style={{
        background: "#FFF7ED", border: "1px solid #FDBA74", borderRadius: 10,
        padding: "12px 14px", fontSize: 13, color: "#7C2D12", lineHeight: 1.9, marginBottom: 16,
      }}>
        <strong>ref に個人名やメールアドレスなど、個人を特定できる情報を入れないでください。</strong>
        <br />
        声かけの「まとまり」を表す名前にしてください。
      </div>

      <div style={{
        background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10,
        padding: "12px 14px", fontSize: 13, color: "#334155", lineHeight: 1.9, marginBottom: 20,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>URL の作り方</div>
        <code style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 6, padding: "2px 6px" }}>
          https://opinio.jp/?ref=sf-alumni-0916
        </code>
        <div style={{ marginTop: 6, color: "#475569" }}>
          どのページに付けても記録されます（<code>/companies/salesforce?ref=…</code> など）。
          使えるのは小文字の英数字・ハイフン・アンダースコアで、{SIGNUP_REF_MAX_LENGTH}文字まで。
          形式に合わない ref は記録されません。
          <br />
          同じ人が複数の URL を踏んだ場合は、<strong>最初の ref</strong> が残ります（上書きしません）。
        </div>
      </div>

      {rows === null ? (
        /* ⚠️ 失敗を「0件」に倒さない。 */
        <p style={{ fontSize: 13, color: "#B91C1C" }}>
          取得に失敗しました（0件という意味ではありません）。時間をおいて再読み込みしてください。
        </p>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "#64748B" }}>対象のユーザーがまだいません。</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10 }}>
          <thead>
            <tr>
              <th style={TH}>ref</th>
              <th style={{ ...TH, textAlign: "right" }}>登録</th>
              <th style={{ ...TH, textAlign: "right" }}>オンボーディング完了</th>
              <th style={{ ...TH, textAlign: "right" }}>経歴あり</th>
              <th style={{ ...TH, textAlign: "right" }}>企業ページで見える</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ref ?? "__none__"}>
                <td style={TD}>
                  {r.ref ?? (
                    <span style={{ color: "#64748B" }}>
                      直接・不明
                      {/* ⚠️ 「効果が無かった」と読ませない。 */}
                      <span style={{ fontSize: 11, marginLeft: 6 }}>（ref 無しで登録）</span>
                    </span>
                  )}
                </td>
                <td style={NUM}>{r.registered}</td>
                <td style={NUM}>{r.onboarded}</td>
                <td style={NUM}>{r.hasExperience}</td>
                <td style={NUM}>{r.visibleOnCompanyPage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.9, marginTop: 14 }}>
        検証用アカウント（is_test）・システムユーザー・本人が登録していない行は除いています。
        <br />
        「企業ページで見える」は、公開されている企業の経歴があり、本人が公開範囲を「非公開」にしていない人の数です。
      </p>
    </div>
  );
}
