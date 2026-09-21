"use client";

import { OrgTreeEditor } from "@/components/business/OrgTreeEditor";
import type { OrgRow } from "@/components/business/OrgTreeEditor";
import { Variant, PreviewHeader } from "../Variant";
import { MAX_ORG_DEPTH } from "@/lib/business/orgTree";
import { JobRolesEditor } from "@/app/biz/organization/JobRolesEditor";
import { DepartmentsEditor } from "@/app/biz/organization/DepartmentsEditor";

/**
 * 組織体制の編集（/biz/organization）のプレビュー（2026-09-20）。
 *
 * ⚠️★**実データでは踏めない形がほとんど。** 本番の `ow_company_departments` は
 *    ログインできる企業でほぼ空で、**5階層・長い名前・兄弟が多い木**を実画面で作るには
 *    本番に行を作ることになる（dev も本番 DB を見る）。**ここで見る。**
 *
 * ⚠️ 追加・移動・削除のボタンは押すと API を叩く。**この画面では未ログイン相当で
 *    401 になり、赤いエラー帯が出るのが正しい。** ここで見るのは
 *    **並び・字下げ・罫線・hover で出る操作・畳みの見え方**まで。
 *
 * ⚠️★`"use client"` にしてあるのは `devOnly()` が使えないため。
 *    **代わりに本番では真っ白になる**（下記）。DB は読んでいない。
 */

/* ⚠️ `devOnly()` はサーバー専用なので、クライアント側は自分で閉じる。
      `NODE_ENV` はビルド時に静的置換されるので、本番バンドルからは中身ごと落ちる。 */
const IS_DEV = process.env.NODE_ENV !== "production";

function row(id: string, name: string, parent: string | null, order: number): OrgRow {
  return { id, parent_id: parent, name, display_order: order };
}

/** 2階層。いちばん普通の形 */
const SHALLOW: OrgRow[] = [
  row("a", "営業本部", null, 0),
  row("a1", "第1営業部", "a", 0),
  row("a2", "第2営業部", "a", 1),
  row("b", "カスタマーサクセス部", null, 1),
  row("c", "コーポレート本部", null, 2),
  row("c1", "人事部", "c", 0),
  row("c2", "経理部", "c", 1),
];

/** 上限ちょうど。⚠️ 5階層目の行で「→（一段下げる）」が押せないこと */
const DEEP: OrgRow[] = [
  row("d1", "1階層目", null, 0),
  row("d2", "2階層目", "d1", 0),
  row("d3", "3階層目", "d2", 0),
  row("d4", "4階層目", "d3", 0),
  row("d5", `5階層目（ここが上限＝${MAX_ORG_DEPTH}）`, "d4", 0),
  row("e1", "隣の最上位", null, 1),
];

/** 長い名前・兄弟が多い。⚠️ 折り返しても操作ボタンが押し出されないこと */
const LONG: OrgRow[] = [
  row("L", "グローバルエンタープライズセールス統括本部（アジアパシフィック）", null, 0),
  ...Array.from({ length: 8 }, (_, i) =>
    row(`L${i}`, `第${i + 1}営業部：金融・保険ソリューション担当チーム`, "L", i)),
];

export default function OrgTreePreview() {
  if (!IS_DEV) return null;
  return (
    <div>
      <PreviewHeader title="組織体制の編集（部門・職種）">
        <code>/biz/organization</code> の中身（<code>OrgTreeEditor</code>）です。
        <strong>部門タブと職種タブが同じ部品</strong>を使っています。
        <br />
        見るところ：<strong>行にマウスを乗せたときだけ操作が出る</strong>こと／
        縦の罫線で親子が追えること／三角で畳めること／
        <strong>いちばん上の行で ↑ が押せない</strong>・
        <strong>5階層目で → が押せない</strong>こと。
      </PreviewHeader>

      <Variant
        label="0件（まだ何も無い）"
        note="⚠️ 空の箱を出さず、入力欄が最初から開いていること。『閉じる』も出ないこと（閉じる先が無いため）"
      >
        <OrgTreeEditor unit="部門" endpoint="/api/biz/departments" createdKey="department"
          initialRows={[]} example="営業部" hints={[<>ここにヒントが入ります</>]} />
      </Variant>

      <Variant
        label="2階層（よくある形）"
        note="⚠️ 子の左に縦の罫線があること。子を持たない行も名前の左端が揃っていること。求人のある行（第1営業部・カスタマーサクセス部・人事部）にだけ件数が出ること"
      >
        <OrgTreeEditor unit="部門" endpoint="/api/biz/departments" createdKey="department"
          initialRows={SHALLOW} example="営業部"
          usage={{ counts: { a1: 3, b: 1, c1: 12 }, noun: "求人" }}
          hints={[<>行の ↑ ↓ で並べ替え、← → で階層を変えられます</>]} />
      </Variant>

      <Variant
        label={`${MAX_ORG_DEPTH}階層（上限ちょうど）`}
        note="⚠️ いちばん深い行で「一段下げる（→）」が押せないこと。字下げしても操作が画面外へ出ないこと"
      >
        <OrgTreeEditor unit="部門" endpoint="/api/biz/departments" createdKey="department"
          initialRows={DEEP} example="営業部" hints={[<>上限は{MAX_ORG_DEPTH}階層です</>]} />
      </Variant>

      <Variant
        label="長い名前 × 兄弟8件"
        note="⚠️ 名前が折り返しても操作ボタンが右にはみ出さないこと。畳むと件数（8）が出ること"
      >
        <OrgTreeEditor unit="職種" endpoint="/api/biz/job-roles" createdKey="jobRole"
          initialRows={LONG} example="フィールドセールス"
          hints={[<>職種名は社内の呼び方で構いません</>]} />
      </Variant>

      <Variant
        label="職種と部門の紐付け：職種タブ"
        note="⚠️ 各行の下に「所属する部門」。インサイドセールスは2部門。チェックを付け外しすると、この画面では未ログインで保存に失敗し、選択が元に戻って理由が出るのが正しい"
      >
        <JobRolesEditor
          initialRoles={[
            { id: "r1", parent_id: null, name: "インサイドセールス", standard_role_id: null, display_order: 0 },
            { id: "r2", parent_id: null, name: "フィールドセールス", standard_role_id: null, display_order: 1 },
            { id: "r3", parent_id: null, name: "バックエンドエンジニア", standard_role_id: null, display_order: 2 },
          ]}
          standardRoles={[]}
          departments={SHALLOW}
          roleDepartments={{ r1: ["a1", "b"], r2: ["a2"] }}
        />
      </Variant>

      <Variant
        label="職種と部門の紐付け：部門タブ（読むだけ）"
        note="⚠️ 紐付いた部門の行にだけ「この部門の職種：…」。部門タブでは付け外しできない"
      >
        <DepartmentsEditor
          initialDepartments={SHALLOW}
          roleDepartments={{ r1: ["a1", "b"], r2: ["a2"] }}
          jobRoles={[{ id: "r1", name: "インサイドセールス" }, { id: "r2", name: "フィールドセールス" }]}
        />
      </Variant>

      <Variant
        label="職種と部門の紐付け：閲覧だけ"
        note="⚠️ 付いている部門だけ出る。「＋ 部門を選ぶ」も ✕ も出ない。何も付いていない職種には行が出ない"
      >
        <JobRolesEditor
          initialRoles={[
            { id: "r1", parent_id: null, name: "インサイドセールス", standard_role_id: null, display_order: 0 },
            { id: "r3", parent_id: null, name: "バックエンドエンジニア", standard_role_id: null, display_order: 1 },
          ]}
          standardRoles={[]}
          departments={SHALLOW}
          roleDepartments={{ r1: ["a1", "b"] }}
          readOnly
        />
      </Variant>

      <Variant
        label="閲覧だけ（管理者でないメンバー）"
        note="⚠️ 追加欄・「＋ 追加する」・行の操作・使い方が出ないこと。ダブルクリックでも名前が編集にならないこと。案内の一文が出ること"
      >
        <OrgTreeEditor unit="部門" endpoint="/api/biz/departments" createdKey="department"
          initialRows={SHALLOW} example="営業部" readOnly
          hints={[<>ここは出ないはず</>]} />
      </Variant>

      <Variant
        label="閲覧だけ × 0件"
        note="⚠️ 入力欄が自動で開かないこと（0件のとき管理者には開く）"
      >
        <OrgTreeEditor unit="職種" endpoint="/api/biz/job-roles" createdKey="jobRole"
          initialRows={[]} example="フィールドセールス" readOnly
          hints={[<>ここは出ないはず</>]} />
      </Variant>
    </div>
  );
}
