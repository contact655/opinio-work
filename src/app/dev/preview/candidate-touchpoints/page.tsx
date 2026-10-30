import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { PreviewHeaderLines, CompanyContactsSection } from "@/app/biz/(app)/candidates/CandidatePreview";
import type { Candidate, CompanyContactItem } from "@/lib/business/candidates/model";

/**
 * ★候補者検索の右欄「自社との接点」（2026-10-28 / 柴さんの指示）。それまでの「〈会社名〉と合うところ」を置き換えた。
 * ⚠️ 実データでは出る側をほとんど描けない —— 元社員は候補者一覧に出ない（在籍企業には表示しない決まり）、
 *    人の流れは5人以上の会社が無い、「話を聞いてみたい」の記録も0件（2026-10-28 実測）。ここで見る。
 * ⚠️ DB は読まない（固定データ）。
 */
const ALUMNI: CompanyContactItem = { kind: "alumni", text: "元社員（職歴にこの会社があります）" };
const INTEREST: CompanyContactItem = { kind: "interest", text: "「話を聞いてみたい」を御社に送っています" };
const FLOW: CompanyContactItem = { kind: "flow", text: "株式会社サンプルテックから御社に入社した人 7人" };
const HISTORY = { latest: { at: "2025-03-14T02:00:00Z", title: "応募：インサイドセールス" }, more: 2 };

/* 右欄の上の段（要約）に要る項目だけ。⚠️ 部品は本番と同じ */
const person = (careerStance: string | null) => ({ careerStance, startedAt: "2023-04-01", location: "東京都", careerStanceUpdatedAt: "2026-10-20T00:00:00Z" }) as unknown as Candidate;

export default function Page() {
  devOnly();
  return (
    <div>
      {/* 右欄の要約の列数は /biz/candidates の CSS が持つ。ここでは同じ既定（3列）を置く */}
      <style>{`.cand-summary { grid-template-columns: repeat(3, minmax(0, 1fr)); }`}</style>
      <PreviewHeader title="自社との接点（/biz/candidates の右のプレビュー）">
        <p>2026-10-28 に「合うところ」（緑の箱）と、要約の4マス目「自社との接点」をこの欄に1つにまとめた。元社員・「話を聞いてみたい」・人の流れ（5人以上）・これまでのやり取り。無ければ「なし」、取れなかったら「—」。保存（ブックマーク）は出さない。</p>
      </PreviewHeader>
      <Variant label="全部ある" note="4行。色で強調しない（灰色の枠）">
        <CompanyContactsSection contacts={[ALUMNI, INTEREST, FLOW]} history={HISTORY} />
      </Variant>
      <Variant label="人の流れだけ" note="「〇〇から御社に入社した人 N人」。⚠️ 5人未満の会社は出ない（文言も出さない）">
        <CompanyContactsSection contacts={[FLOW]} history={null} />
      </Variant>
      <Variant label="これまでのやり取りだけ" note="選考管理と同じ最新1件＋ほか件数">
        <CompanyContactsSection contacts={[]} history={{ latest: { at: "2026-09-02T02:00:00Z", title: "カジュアル面談の申込：ポジション指定なし" }, more: 0 }} />
      </Variant>
      <Variant label="何もない" note="「なし」">
        <CompanyContactsSection contacts={[]} history={null} />
      </Variant>
      <Variant label="取得に失敗（undefined）" note="「—」（「なし」と言わない）">
        <CompanyContactsSection contacts={undefined} history={null} />
      </Variant>
      <h2 style={{ fontSize: 16, margin: "32px 0 8px" }}>右欄の要約（2026-10-28 に3マスにした）</h2>
      <Variant label="現職の在籍期間・居住地・意向の更新" note="4マス目の「自社との接点」は上の欄へ移した">
        <PreviewHeaderLines candidate={person("active")} contacts={null} />
      </Variant>
    </div>
  );
}
