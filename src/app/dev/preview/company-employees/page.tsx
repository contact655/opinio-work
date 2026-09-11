import { CurrentEmployeesSection } from "@/app/(jobseeker)/companies/[id]/CompanyEmployeeSections";
import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { EMPLOYEES_1, EMPLOYEES_GROUPED, EMPLOYEES_SAME_ROLE } from "../fixtures";

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
const COMPANY_ID = "preview-company";
const EMPTY_AMBASSADORS = new Map<string, { memberId: string }>();

export default function CompanyEmployeesPreview() {
  devOnly();
  return (
    <div>
      <PreviewHeader title="現役社員（企業ページ）">
        5名以上 ＋ 職種が2種類以上で<strong>職種ごとに分かれます</strong>。
        それ未満は素のグリッドのままです。構成バーは<strong>3名から</strong>出ます。
      </PreviewHeader>

      <Variant label="1名" note="⚠️ 構成バーも分割も出ない。1枚だけ">
        <CurrentEmployeesSection
          employees={EMPLOYEES_1} totalCount={EMPLOYEES_1.length}
          ambassadorMap={EMPTY_AMBASSADORS} companyId={COMPANY_ID} acceptingMeetings={false}
        />
      </Variant>

      {/* ⚠️★**`EMPLOYEES_3` を使わないこと。** あの fixture は
             `roleParentId` を1人ずつ変えて `roleParentName` は「営業」で固定している
             （アバターの色を散らすため）。**グループは id で作り、見出しは名前で出す**ので、
             あれを渡すと「営業」という同じ見出しが3つ並ぶ。実データでは id と名前が
             1対1なので起きないが、**プレビューで確かめたいのはそこではない。** */}
      <Variant label="3名・職種は1種類" note="⚠️ 構成バーも分割も出ない（職種が1種類なので分ける意味が無い）">
        <CurrentEmployeesSection
          employees={EMPLOYEES_SAME_ROLE.slice(0, 3)} totalCount={3}
          ambassadorMap={EMPTY_AMBASSADORS} companyId={COMPANY_ID} acceptingMeetings={false}
        />
      </Variant>

      <Variant label="5名・全員同じ職種" note="⚠️★人数は足りるが職種が1種類。**分割されない**のが正しい">
        <CurrentEmployeesSection
          employees={EMPLOYEES_SAME_ROLE} totalCount={EMPLOYEES_SAME_ROLE.length}
          ambassadorMap={EMPTY_AMBASSADORS} companyId={COMPANY_ID} acceptingMeetings={false}
        />
      </Variant>

      <Variant
        label="9名・職種がばらける（分割表示）"
        note="⚠️★本番では見られない側。親のまま登録した人が子見出し無しで出るか／職種が無い人が「その他」に残るか"
      >
        <CurrentEmployeesSection
          employees={EMPLOYEES_GROUPED} totalCount={EMPLOYEES_GROUPED.length}
          ambassadorMap={EMPTY_AMBASSADORS} companyId={COMPANY_ID} acceptingMeetings={false}
        />
      </Variant>

      <Variant label="未ログイン相当（見出しだけ人数・カード0枚）" note="⚠️ 見出しは非表示の人も数える。カードは0枚で「ログインすると N名」が出る">
        <CurrentEmployeesSection
          employees={[]} hiddenCount={9} totalCount={9}
          ambassadorMap={EMPTY_AMBASSADORS} companyId={COMPANY_ID} acceptingMeetings={false}
        />
      </Variant>
    </div>
  );
}
