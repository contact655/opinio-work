import { CurrentEmployeesSection, AlumniSection } from "@/app/(jobseeker)/companies/[id]/CompanyEmployeeSections";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { EMPLOYEES_1, EMPLOYEES_GROUPED, EMPLOYEES_SAME_ROLE, ALUMNI_3 } from "../fixtures";

/**
 * 企業ページの「現役社員」（2026-09-12）。
 *
 * ⚠️★**この画面を作った理由。** グループ分け（職種ごとの見出し）に入る企業が
 *    **本番に1社も無い**。現役社員が3名の企業が1社、1名が4社だけで、
 *    しきい値（5名以上 ＋ 職種2種類以上）に届かない。
 *    ＝ **実データでは描画できない分岐**なので、ここでしか見られない。
 *
 * ⚠️ グループは**本人が登録した職種から導出**する。企業ごとの設定テーブルは読まない。
 * ⚠️ 求人詳細の `JobEmployeesSection` とは**別の部品**（`/dev/preview/employees` はあちら）。
 */

/* ★2026-10-03: 行の形をそろえたので、確かめる組み合わせを足した。
   ・写真あり／なし（イニシャル）が混ざっても行の高さがそろうか
   ・職種が長い人（2行まで出して省略）
   ⚠️ 面談OK のバッジと「◯◯さんに話を聞く →」は 2026-10-16 に撤去した */
const MIXED = [
  { ...EMPLOYEES_SAME_ROLE[0], avatarUrl: "/icons/apple-touch-icon.png" },
  { ...EMPLOYEES_SAME_ROLE[1], roleTitle: "エンタープライズコーポレートセールス本部 第二営業部 / フィールドセールス（アカウントエグゼクティブ・大手製造業担当）" },
  { ...EMPLOYEES_SAME_ROLE[2], roleTitle: null },
];

export default function CompanyEmployeesPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="現役社員（企業ページ）">
        縦長のカード（2026-10-20）。<strong>職種で段を分けず、全員を1段</strong>に並べます（3人以上は横スクロール・1〜2人は左寄せ）。
        職種の内訳は構成バー（<strong>3名から</strong>）で伝えます。並びは人数の多い職種から。
      </PreviewHeader>

      <Variant label="1名" note="⚠️ 構成バーは出ない。カード1枚を左寄せ">
        <CurrentEmployeesSection
          employees={EMPLOYEES_1} totalCount={EMPLOYEES_1.length}
        />
      </Variant>

      {/* ⚠️★**`EMPLOYEES_3` を使わないこと。** あの fixture は
             `roleParentId` を1人ずつ変えて `roleParentName` は「営業」で固定している
             （アバターの色を散らすため）。**グループは id で作り、見出しは名前で出す**ので、
             あれを渡すと「営業」という同じ見出しが3つ並ぶ。実データでは id と名前が
             1対1なので起きないが、**プレビューで確かめたいのはそこではない。** */}
      <Variant label="3名・職種は1種類" note="⚠️ 構成バーは出ない（職種が1種類）。3人なので横スクロール">
        <CurrentEmployeesSection
          employees={EMPLOYEES_SAME_ROLE.slice(0, 3)} totalCount={3}
        />
      </Variant>

      <Variant label="5名・全員同じ職種" note="⚠️ 職種が1種類なので構成バーは出ない。1段の横スクロール">
        <CurrentEmployeesSection
          employees={EMPLOYEES_SAME_ROLE} totalCount={EMPLOYEES_SAME_ROLE.length}
        />
      </Variant>

      <Variant
        label="9名・職種がばらける"
        note="⚠️ 構成バーで内訳が出て、カードは1段の横スクロール。同じ職種の人が隣り合い、職種が無い人（その他）は最後"
      >
        <CurrentEmployeesSection
          employees={EMPLOYEES_GROUPED} totalCount={EMPLOYEES_GROUPED.length}
        />
      </Variant>

      <Variant label="写真あり・なし・長い職種" note="★行の高さがそろうか／職種は2行で省略か">
        <CurrentEmployeesSection employees={MIXED} totalCount={MIXED.length} />
      </Variant>

      <Variant label="OB/OG 3名" note="★現役と同じ行の形か／「在籍◯年」と「現在：会社・職種」／長い値">
        <AlumniSection alumni={ALUMNI_3} totalCount={ALUMNI_3.length} />
      </Variant>

      <Variant label="OB/OG 0名" note="空のときの表示（変更していない）">
        <AlumniSection alumni={[]} totalCount={0} />
      </Variant>

      <Variant label="未ログイン相当（見出しだけ人数・カード0枚）" note="⚠️ 見出しは非表示の人も数える。カードは0枚で「ログインすると N名」が出る">
        <CurrentEmployeesSection
          employees={[]} hiddenCount={9} totalCount={9}
        />
      </Variant>
    </div>
  );
}
