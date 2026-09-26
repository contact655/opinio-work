import { EmployeesClient } from "@/app/biz/employees/EmployeesClient";
import type { BizEmployee } from "@/app/biz/employees/page";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";

/**
 * `/biz/employees`（社員管理）のプレビュー（2026-09-18）。
 *
 * ⚠️★**この画面を作った理由。** B6 で足した3つ——管理者バッジ・面談OKバッジ・
 *    職種の併記——は、**ログインできるどの企業にも該当者が居ない**ので実データで
 *    一度も描画できない。実測（2026-09-18 / 本番）: この管理者が入れる3社
 *    （Third Box / 【テスト】サンプルワークス / 株式会社Opinio）はいずれも
 *    `visibility_company='real'` かつ `is_test=false` の経歴が **0件**。
 *
 * ⚠️ 面談OKは**現役にだけ**出る（退職しても `ow_company_members` の行は残るため）。
 *    OB・OG のタブにオレンジのバッジが出ていたら、それは不具合。
 */
const base = {
  avatarUrl: null,
  isAdmin: false,
  isTalkable: false,
  startedAt: "2021-04-01",
  endedAt: null,
  isCurrent: true,
} satisfies Omit<BizEmployee, "experienceId" | "userId" | "name" | "roleName" | "roleTitle">;

const CURRENT: BizEmployee[] = [
  { ...base, experienceId: "e1", userId: "u1", name: "山田 太郎",
    roleName: "エンタープライズセールス", roleTitle: "金融営業本部 営業第1部 / 法人営業（アカウント営業）" },
  { ...base, experienceId: "e2", userId: "u2", name: "佐藤 花子",
    roleName: "フィールドセールス", roleTitle: null, isAdmin: true },
  { ...base, experienceId: "e3", userId: "u3", name: "鈴木 一郎",
    roleName: "インサイドセールス", roleTitle: "SDR", isTalkable: true },
  { ...base, experienceId: "e4", userId: "u4", name: "高橋 二郎",
    roleName: "カスタマーサクセス", roleTitle: "CSM", isAdmin: true, isTalkable: true },
  /* ⚠️ マスタ名も呼び方も無い行。**行ごと出ない**のが正しい（氏名と期間だけになる） */
  { ...base, experienceId: "e5", userId: "u5", name: "田中 三郎",
    roleName: null, roleTitle: null },
  /* ⚠️ 呼び方だけある行（マスタ名が NULL の古い経歴）。小さい方だけが出る */
  { ...base, experienceId: "e6", userId: "u6", name: "伊藤 四郎",
    roleName: null, roleTitle: "第6営業部" },
  /* ⚠️ 折り返しの確認。氏名もバッジも職種も長い */
  { ...base, experienceId: "e7", userId: "u7",
    name: "サンプル 長々しい氏名ですここで折り返るかを見る",
    roleName: "ソリューションエンジニア・セールスエンジニア",
    roleTitle: "エンタープライズ営業統括本部 第2ソリューション部 / プリセールス（金融担当）",
    isAdmin: true, isTalkable: true },
];

const ALUMNI: BizEmployee[] = [
  { ...base, experienceId: "a1", userId: "u8", name: "退職 太郎",
    roleName: "フィールドセールス", roleTitle: "AE",
    isCurrent: false, endedAt: "2024-03-31" },
  /* ⚠️★`ow_company_members` の行が残っている退職者。**面談OKを出さない**のが正しい。
        `isTalkable` はサーバー側で `isCurrent` と AND を取ってあるので false で渡る。 */
  { ...base, experienceId: "a2", userId: "u9", name: "退職 花子",
    roleName: "カスタマーサクセス", roleTitle: null,
    isCurrent: false, endedAt: "2023-09-30", isAdmin: true },
];

export default function BizEmployeesPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="社員管理（/biz/employees）">
        タブは<strong>2つだけ</strong>（現役社員 / OB・OG社員）。
        職種は<strong>マスタ名が主で、社内での呼び方を小さく併記</strong>します。
        どちらも無い行は<strong>職種の行ごと出ません</strong>。
      </PreviewHeader>

      <Variant label="現役7件（管理者・面談OK・職種の3パターン）" note="⚠️ 5人目は職種の行が丸ごと無いこと。6人目は小さい方だけ出ること">
        <EmployeesClient current={CURRENT} alumni={ALUMNI} hiddenExperienceIds={[]} reportedExperienceIds={[]} rejectedExperiences={[]} companyName="株式会社サンプル" />
      </Variant>

      <Variant label="非表示（運営）と報告済みが混ざる" note="⚠️★非表示の行は表示だけ残し、操作は出さない（戻すのは運営）。1人目は「運営に報告済み」でボタンが消えていること">
        <EmployeesClient current={CURRENT} alumni={ALUMNI} hiddenExperienceIds={["e3", "e5"]} reportedExperienceIds={["e1"]} rejectedExperiences={[{ experienceId: "e2", note: "本人に確認したところ、在籍期間の記載に誤りはありませんでした" }, { experienceId: "e4", note: null }]} companyName="株式会社サンプル" />
      </Variant>

      <Variant label="0件（空状態）" note="⚠️ 企業側から追加できないことが文面で伝わるか">
        <EmployeesClient current={[]} alumni={[]} hiddenExperienceIds={[]} reportedExperienceIds={[]} rejectedExperiences={[]} companyName="株式会社サンプル" />
      </Variant>
    </div>
  );
}
