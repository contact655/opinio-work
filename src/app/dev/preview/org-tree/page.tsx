"use client";

import { Variant, PreviewHeader } from "../Variant";
import { MAX_ORG_DEPTH } from "@/lib/business/orgTree";
import { JobRolesEditor, type CompanyJobRole } from "@/app/biz/organization/JobRolesEditor";
import { DepartmentsWorkspace, type Department } from "@/app/biz/organization/DepartmentsWorkspace";
import type { StandardRole } from "@/app/biz/organization/StandardRoleCombobox";

/**
 * 部門・職種（/biz/organization）のプレビュー（2026-09-20 / 2026-10-12 に部門タブを一覧＋編集パネルへ作り直した）。
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

function row(id: string, name: string, parent: string | null, order: number): Department {
  return { id, parent_id: parent, name, display_order: order };
}

/** 2階層。いちばん普通の形 */
const SHALLOW: Department[] = [
  row("a", "営業本部", null, 0),
  row("a1", "第1営業部", "a", 0),
  row("a2", "第2営業部", "a", 1),
  row("b", "カスタマーサクセス部", null, 1),
  row("c", "コーポレート本部", null, 2),
  row("c1", "人事部", "c", 0),
  row("c2", "経理部", "c", 1),
];

/** 上限ちょうど。⚠️ 5階層目の行の ⋯ で「下に部門を追加」が押せないこと */
const DEEP: Department[] = [
  row("d1", "1階層目", null, 0),
  row("d2", "2階層目", "d1", 0),
  row("d3", "3階層目", "d2", 0),
  row("d4", "4階層目", "d3", 0),
  row("d5", `5階層目（ここが上限＝${MAX_ORG_DEPTH}）`, "d4", 0),
  row("e1", "隣の最上位", null, 1),
];

/** 長い名前・兄弟が多い。⚠️ 折り返しても操作ボタンが押し出されないこと */
const LONG: Department[] = [
  row("L", "グローバルエンタープライズセールス統括本部（アジアパシフィック）", null, 0),
  ...Array.from({ length: 8 }, (_, i) =>
    row(`L${i}`, `第${i + 1}営業部：金融・保険ソリューション担当チーム`, "L", i)),
];

/** 標準の職種（固定データ。DB は読まない） */
const STD: StandardRole[] = [
  { id: "s-sales", name: "営業", parent_id: null, display_order: 1 },
  { id: "s-is", name: "インサイドセールス", parent_id: "s-sales", display_order: 1 },
  { id: "s-fs", name: "フィールドセールス", parent_id: "s-sales", display_order: 2 },
  { id: "s-cs", name: "カスタマーサクセス", parent_id: "s-sales", display_order: 3 },
  { id: "s-eng", name: "エンジニア", parent_id: null, display_order: 2 },
  { id: "s-be", name: "バックエンドエンジニア", parent_id: "s-eng", display_order: 1 },
];
const ROLES: CompanyJobRole[] = [
  { id: "r1", parent_id: null, name: "IS", standard_role_id: "s-is", display_order: 0 },
  { id: "r2", parent_id: null, name: "フィールドセールス", standard_role_id: "s-fs", display_order: 1 },
  { id: "r3", parent_id: null, name: "CSM", standard_role_id: null, display_order: 2 },
  { id: "r4", parent_id: null, name: "バックエンドエンジニア", standard_role_id: "s-be", display_order: 3 },
];
const LINKS = { r1: ["a1", "b"], r2: ["a2"], r3: ["b"], r4: [] as string[] };

export default function OrgTreePreview() {
  if (!IS_DEV) return null;
  return (
    <div>
      <PreviewHeader title="部門・職種（/biz/organization）">
        部門タブは<strong>左に一覧・行を押すと右に編集パネル</strong>（1280px 以上は左右、未満はパネルが一覧の上に全幅）。
        職種タブは<strong>読むだけの一覧</strong>で、部門名から部門タブのパネルへ飛ぶ。
        <br />
        ⚠️ 保存・並べ替え・削除は API を叩くので、この画面では未ログインで失敗して赤い帯が出るのが正しい。DB は読んでいない。
      </PreviewHeader>

      <Variant label="0件（まだ何も無い）" note="⚠️ 空の案内と「＋ 部門を追加」だけが出ること">
        <DepartmentsWorkspace initialDepartments={[]} initialRoles={[]} standardRoles={STD} initialRoleDepartments={{}} />
      </Variant>

      <Variant
        label="2階層＋職種あり（よくある形）"
        note="⚠️ 2行目に「この部門の職種：…」。カスタマーサクセス部にだけ灰色で「標準の職種が未設定（1）」。求人のある行にだけ件数。取っ手と ⋯ が出ること"
      >
        <DepartmentsWorkspace initialDepartments={SHALLOW} initialRoles={ROLES} standardRoles={STD}
          initialRoleDepartments={LINKS} usage={{ a1: 3, b: 1, c1: 12 }} />
      </Variant>

      <Variant
        label="編集パネルを開いた状態（カスタマーサクセス部）"
        note="⚠️ 1280px 以上で右に 440px のパネル。CSM は標準の職種が空なので「保存」が押せず「標準の職種を選ぶと保存できます」"
      >
        <DepartmentsWorkspace initialDepartments={SHALLOW} initialRoles={ROLES} standardRoles={STD}
          initialRoleDepartments={LINKS} initialSelectedId="b" />
      </Variant>

      <Variant label={`${MAX_ORG_DEPTH}階層（上限ちょうど）`} note="⚠️ いちばん深い行の ⋯ で「下に部門を追加」が押せないこと。字下げしても ⋯ が画面外へ出ないこと">
        <DepartmentsWorkspace initialDepartments={DEEP} initialRoles={[]} standardRoles={STD} initialRoleDepartments={{}} />
      </Variant>

      <Variant label="長い名前 × 兄弟8件" note="⚠️ 名前が折り返しても ⋯ が右にはみ出さないこと">
        <DepartmentsWorkspace initialDepartments={LONG} initialRoles={[]} standardRoles={STD} initialRoleDepartments={{}} />
      </Variant>

      <Variant label="閲覧だけ（管理者でないメンバー）" note="⚠️ 取っ手・⋯・「＋ 部門を追加」が出ないこと。行を押すとパネルは開くが入力できず、保存ボタンが無いこと">
        <DepartmentsWorkspace initialDepartments={SHALLOW} initialRoles={ROLES} standardRoles={STD} initialRoleDepartments={LINKS} readOnly />
      </Variant>

      <Variant label="職種タブ（読むだけ）" note="⚠️ 呼び方が標準の職種名と同じ行は「—」。CSM は標準の職種が「未設定」。バックエンドエンジニアは「部門なし」。部門名はリンク">
        <JobRolesEditor roles={ROLES} standardRoles={STD} departments={SHALLOW} roleDepartments={LINKS} usage={{ r1: 2, r3: 1 }} />
      </Variant>

      <Variant label="職種タブ × 紐付けを読めなかった" note="⚠️ 部門の列が「部門なし」ではなく「—」になること">
        <JobRolesEditor roles={ROLES} standardRoles={STD} departments={SHALLOW} />
      </Variant>
    </div>
  );
}
