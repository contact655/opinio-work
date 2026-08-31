import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { EditorRoundTrip } from "./EditorRoundTrip";

/**
 * 福利厚生の入力 → 保存 → 表示 を通しで見る（2026-08-31）。
 *
 * ⚠️ `/biz/company` は認証の内側なので、部品だけをここに出している。
 *    ページ側の配線は型では通っているが、**画面で押した検証はまだ**（下の注記）。
 */
export default function BenefitsEditorPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="福利厚生の入力 → 保存 → 表示">
        企業が入力したものが<strong>どう保存され、求職者にどう見えるか</strong>を
        1画面で確かめます。<code>/biz/company</code> と<strong>同じ部品・同じ関数</strong>を通します。
      </PreviewHeader>

      <Variant
        label="往復（触って確かめる）"
        note="⚠️★詳細を打つと ② の JSON に出るか / 空にするとキーごと消えるか / ③ で「詳細を見る」が出るか"
      >
        <EditorRoundTrip />
      </Variant>

      <div style={{
        marginTop: 8, padding: "12px 14px", borderRadius: 8,
        background: "#FFFBEB", border: "1px solid #FDE68A",
        fontSize: 12, color: "#92400E", lineHeight: 1.8,
      }}>
        ⚠️ <strong>これは <code>/biz/company</code> の完全な代わりにはなりません。</strong>
        ページ側の配線（<code>items={"{form.benefitsTags}"}</code> /
        <code>onChange</code> → <code>update(&quot;benefitsTags&quot;, …)</code>）は
        型では通っていますが、<strong>実際にログインして押した検証はまだです</strong>。
        CLAUDE.md「認証の内側は実際に踏むまで壊れていても分からない」。
      </div>
    </div>
  );
}
