import { PanelProfileView, type PanelProfileData } from "@/components/profile/view/PanelProfileView";
import { Variant, PreviewHeader } from "../Variant";
import { PanelExtraSectionsProvider } from "@/components/profile/view/PanelProfileScroll";
import { TouchpointSection } from "@/app/biz/candidates/CandidatePreview";
import type { Touchpoint } from "@/lib/business/candidates/model";
import { devOnly } from "../guard";
import { CAREERS_RICH, CAREERS_SAME_COMPANY, CAREERS_RANK, EDUCATIONS_2 } from "../fixtures";

/**
 * 右欄のプロフィール（候補者を探す・メッセージのドロワー）の詰まった表示（2026-10-11）。
 *
 * ⚠️ 検証用の候補者は項目が薄い（2026-10-11 実測: 職歴3件・自己紹介なし が最大）。
 *    全部の項目がそろった状態はここでしか見られない。
 * ⚠️★この配下で DB を読まないこと。固定データだけを渡す。
 */

const EMPTY: PanelProfileData = {
  aboutMe: null, careers: [], educations: [], unplacedEducations: [], skills: [], autoSkills: [],
  achievements: [], awards: [], certifications: [], languages: [], mediaAppearances: [],
  featuredArticles: [], contentLinks: [], socialLinks: {}, posts: [],
};

const FULL: PanelProfileData = {
  aboutMe: "法人営業を10年。直近は製造業向けのエンタープライズ営業で、導入から定着までを担当しています。\n次はプロダクトに近い立場で、顧客の課題を一緒に解く仕事がしたいと考えています。",
  careers: [...CAREERS_RICH, ...CAREERS_SAME_COMPANY, ...CAREERS_RANK],
  educations: EDUCATIONS_2,
  unplacedEducations: [{ id: "ue1", school: "検証高等学校", faculty: null, degree: null, school_master: null }],
  skills: [
    { id: "s1", skill: { label: "Salesforce", category: "product" } },
    { id: "s2", skill: { label: "The Model", category: "method" } },
  ],
  autoSkills: [
    { label: "フィールドセールス", kind: "role", band: "5年以上", months: 70 },
    { label: "CRM・営業支援", kind: "domain", band: "3年以上", months: 40 },
  ],
  achievements: [{ id: "a1", title: "年間売上目標", value: "142", unit: "%", description: "2024年度・エンタープライズ部門" }],
  awards: [{ id: "w1", title: "社長賞", issuer: "検証株式会社", awarded_at: "2023-03-01" }],
  certifications: [{ id: "c1", name: "Salesforce 認定アドミニストレーター", issuer: "Salesforce", issued_at: "2022-06-01" }],
  languages: [{ id: "l1", name: "英語", proficiency: "professional" }],
  mediaAppearances: [{ id: "m1", title: "製造業DXの現場から", media_name: "検証メディア", url: "https://example.com/a", appeared_at: "2024-05-01" }],
  featuredArticles: [],
  contentLinks: [{ id: "cl1", url: "https://note.com/example/n/1", title: "営業の引き継ぎについて" }],
  socialLinks: { linkedin: "https://www.linkedin.com/in/example" },
  posts: [{ id: "p1", content: "今日は新しいチームの立ち上げでした。最初の一週間で決めておくことを書き出しています。", created_at: "2026-10-01T09:00:00Z" }],
};

const TOUCH: Touchpoint[] = [
  { kind: "job_role", text: "求人『法人営業（SaaS）』と同じ職種の経験があります（経験5年）", weight: 5, ref: null },
  { kind: "location", text: "求人の勤務地（東京都）とお住まいが合っています", weight: 1, ref: null },
  { kind: "business_domain", text: "同じ事業領域（CRM・営業支援・マーケティング）の会社での経験があります", weight: 2, ref: null },
];

export default function Page() {
  devOnly();
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 80px" }}>
      <PreviewHeader title="右欄のプロフィール（詰まった表示）">
        帯・大きな顔アイコン・名前の段を出さず、職歴 → スキル → 自己紹介 → 学歴 → 残り → アクティビティの順に平らに並べる。
      </PreviewHeader>
      {/* ★候補者を探すの右欄（1本のスクロール。2026-10-12）。⚠️ 固定の高さの箱の中でスクロールさせる（帯と下線を確かめるため） */}
      <Variant label="候補者を探すの右欄（1本のスクロール・全部の項目＋メモ）" note="先頭に合うところ（2件＋ほか1件）。帯は中身のある節だけ。スクロールすると下線がいまの節に移る">
        <div data-state="dev-panel-scroll" style={{ maxWidth: 560, height: 560, overflowY: "auto", padding: "0 20px 20px", border: "1px dashed var(--line)", background: "#fff" }}>
          <TouchpointSection touchpoints={TOUCH} companyShortName="Third Box" />
          <PanelExtraSectionsProvider sections={[{ key: "notes", label: "メモ", body: <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>（社内メモの欄。CANDIDATE_NOTES_ENABLED のときだけ）</p> }]}>
            <PanelProfileView data={FULL} sectioned />
          </PanelExtraSectionsProvider>
        </div>
      </Variant>
      <Variant label="全部の項目がある" note="小見出しは日本語だけ・カードの入れ子なし・在籍中はバッジでなく「〜現在」・役職は区分（社内の呼び方）の対">
        <div style={{ maxWidth: 560, padding: "0 20px", border: "1px dashed var(--line)" }}><PanelProfileView data={FULL} /></div>
      </Variant>
      <Variant label="職歴だけ" note="空の項目（自己紹介・学歴・アクティビティなど）は見出しごと出ない">
        <div style={{ maxWidth: 560, padding: "0 20px", border: "1px dashed var(--line)" }}><PanelProfileView data={{ ...EMPTY, careers: CAREERS_RICH.slice(0, 1) }} /></div>
      </Variant>
      <Variant label="何も無い" note="項目ごとの空表示は出さず、1行だけ">
        <div style={{ maxWidth: 560, padding: "0 20px", border: "1px dashed var(--line)" }}><PanelProfileView data={EMPTY} /></div>
      </Variant>
    </div>
  );
}
