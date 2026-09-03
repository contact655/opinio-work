"use client";

import { useState } from "react";
import { RolePicker, type PickerRole } from "@/components/onboarding/RolePicker";
import { MAX_ROLES_PER_EXPERIENCE as MAX_ROLES } from "@/lib/constants/experienceRoles";

/**
 * 固定データで `RolePicker` を動かす枠。**DB は読まない**（`guard.ts` の注記）。
 * 初期選択だけ渡して、あとは実物どおり押せるようにしてある。
 */
export function RolePickerDemo({ initial }: { initial: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <RolePicker roles={PREVIEW_ROLES} value={value} onChange={setValue} max={MAX_ROLES} />
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--ink-mute)", lineHeight: 1.6 }}>
        選択中 {value.length} / {MAX_ROLES}：{value.map(idToName).join("・") || "（なし）"}
      </p>
    </>
  );
}

function idToName(id: string) {
  return PREVIEW_ROLES.find((r) => r.id === id)?.name ?? id;
}

/* ⚠️ 本番の `ow_roles` から書き写した固定データ（2026-09-04 / 親18件）。
      子は**指摘のあった2つ**（営業・エンジニア）だけ入れてある。
      ⚠️ 件数が本番と完全一致している必要は無い。ここで見るのは
         **親を複数開いたときに境目が読めるか**であって、語彙の正しさではない。 */
const P = (name: string): PickerRole => ({ id: `p-${name}`, name, parent_id: null });
const C = (parent: string, name: string): PickerRole => ({ id: `c-${name}`, name, parent_id: `p-${parent}` });

export const PREVIEW_ROLES: PickerRole[] = [
  P("経営・CxO"), P("事業開発"), P("営業"), P("カスタマーサクセス"),
  P("マーケティング"), P("プロダクト"), P("デザイナー"), P("データ・AI"),
  P("エンジニア"), P("コーポレート"), P("医療・介護・福祉"),
  P("建設・不動産"), P("製造・技術"), P("教育・研究"), P("販売・サービス"),
  P("金融・保険"), P("物流・運輸"), P("公務・その他"),

  C("営業", "インサイドセールス"), C("営業", "フィールドセールス"),
  C("営業", "SDR（反響・インバウンド）"), C("営業", "BDR（新規開拓・アウトバウンド）"),
  C("営業", "エンタープライズセールス"), C("営業", "アカウントエグゼクティブ"),
  C("営業", "アカウントマネージャー"), C("営業", "パートナーセールス・アライアンス"),
  C("営業", "ソリューションエンジニア・プリセールス"), C("営業", "ソリューションアーキテクト"),
  C("営業", "営業企画・Sales Ops"), C("営業", "その他営業"),

  C("エンジニア", "バックエンド"), C("エンジニア", "フロントエンド"),
  C("エンジニア", "フルスタック"), C("エンジニア", "SRE・インフラ"),
  C("エンジニア", "iOS/Android"), C("エンジニア", "QA・テストエンジニア"),
  C("エンジニア", "DevOps・プラットフォーム"), C("エンジニア", "セキュリティエンジニア"),
  C("エンジニア", "データベース・ネットワーク"), C("エンジニア", "社内SE・情シス"),
  C("エンジニア", "テクニカルサポート・運用"), C("エンジニア", "エンジニアリングマネージャー"),
  C("エンジニア", "テックリード・アーキテクト"), C("エンジニア", "その他エンジニア"),
];
