import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { JobRelatedPeopleCard } from "@/components/jobs/JobRelatedPeopleCard";
import type { RelatedPerson } from "@/lib/jobs/relatedPeopleTypes";

/**
 * 求人ページのサイドバー「この募集に関わる人」の見本（2026-11-26）。
 *
 * ⚠️ この画面を作った理由: 本番で求人ページが出る会社（COIN）は採用担当1人だけで、
 *    配属先マネージャーとチームメンバーが出る側を実データで描けない。
 * ⚠️ ここで DB を読まないこと。固定データだけを渡す。
 * ⚠️ メッセージのボタンは DMButton が相手ごとに送れるかを聞いてから出すので、ここ（架空の人）では出ない。
 *    出る条件（canMessage）は採用担当と配属先マネージャーだけ。
 */
const R = (id: string, name: string, title: string | null): RelatedPerson => ({ userId: id, name, avatarUrl: null, title, roles: ["recruiter"], canMessage: true });
const M = (id: string, name: string, title: string | null): RelatedPerson => ({ userId: id, name, avatarUrl: null, title, roles: ["manager"], canMessage: true });
const T = (id: string, name: string, title: string | null): RelatedPerson => ({ userId: id, name, avatarUrl: null, title, roles: ["member"], canMessage: false });

const ONLY_RECRUITER = [R("r1", "山田 崚人", null)];
const FULL = [
  R("r1", "山田 崚人", "人事部 ・ 採用担当"),
  M("m1", "佐藤 健一", "SaaS 営業チームのマネージャー"),
  T("t1", "高橋 美咲", "フィールドセールス"),
  T("t2", "田中 翔太", "エンタープライズ営業"),
  T("t3", "伊藤 彩", null),
];
const BOTH_ROLES = [
  { ...R("r1", "鈴木 涼太", "営業部長"), roles: ["recruiter", "manager"] as RelatedPerson["roles"] },
  T("t1", "高橋 美咲", "フィールドセールス"),
];
const LONG = [
  R("r1", "アレクサンドラ・ヴィクトリア・サンチェス・ロドリゲス", "グローバル・タレント・アクイジション・パートナー（日本・韓国・台湾担当）"),
  M("m1", "長谷川 健太郎", "エンタープライズ・ソリューション営業本部 第二営業部 部長代理"),
];

export default function Page() {
  devOnly();
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <style>{`
        .jd-card { background: #fff; border: 1px solid var(--line); border-radius: 14px; }
        .jd-side-card { padding: 20px; }
        .rp-col { max-width: 300px; }
      `}</style>
      <PreviewHeader title="求人ページ「この募集に関わる人」">
        採用担当 → 配属先マネージャー → チームメンバー（最大3人）。役割は名前の上に小さく出す。
      </PreviewHeader>
      <Variant label="採用担当だけ" note="今までの「採用担当」カードと同じ（見出しも役割の表示も変えない）">
        <div className="rp-col"><JobRelatedPeopleCard people={ONLY_RECRUITER} preview={false} /></div>
      </Variant>
      <Variant label="3つの役割がそろう" note="採用担当1・マネージャー1・メンバー3">
        <div className="rp-col"><JobRelatedPeopleCard people={FULL} preview={false} /></div>
      </Variant>
      <Variant label="同じ人が採用担当とマネージャー" note="1回だけ出し、役割をまとめる">
        <div className="rp-col"><JobRelatedPeopleCard people={BOTH_ROLES} preview={false} /></div>
      </Variant>
      <Variant label="長い名前・肩書き" note="折り返して、はみ出さない">
        <div className="rp-col"><JobRelatedPeopleCard people={LONG} preview={false} /></div>
      </Variant>
      <Variant label="0人" note="何も描かない（この下に何も出ないのが正しい）">
        <div className="rp-col"><JobRelatedPeopleCard people={[]} preview={false} /></div>
      </Variant>
    </main>
  );
}
