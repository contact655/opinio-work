"use client";

import { useMemo, useState } from "react";
import MergedTimeline from "@/components/profile/MergedTimeline";
import CareerHistoryEditor, { type Stint } from "@/components/profile/CareerHistoryEditor";
import StoryAccordion from "@/components/profile/StoryAccordion";
import { stintsToCareerEntries } from "@/components/profile/editor/careerTimeline";
import type { CompanyLogoInfo } from "@/lib/utils/timeline";
import { DetailsFrame, DetailsEmpty } from "./DetailsFrame";

/**
 * 職歴の一覧ページ（2026-08-17 / フェーズ3）。
 *
 * ⚠️ **行の表示は本体と同じ `MergedTimeline`。** 違うのは「全件出す」ことと
 *    「行ごとの鉛筆・ゴミ箱・『この会社に役割を追加』を出す」ことだけ。
 *
 * ⚠️ **「＋ この会社に役割を追加」はこのページにも出す。** 会社のまとまりの中に出る操作で、
 *    本体では会社ごとの行を全部見せていないため置き場所が無い。行の操作と同じ扱いにする。
 *
 * ── ★経歴ストーリー（`StoryAccordion`）の置き場所（2026-08-23 に戻した）──────
 * ⚠️ **`/mypage` 本体ではなくここ。** 本体は `careerActions` を渡しておらず
 *    「1件ずつ触るのは `/mypage/details/experience` の仕事」と決めてある。
 *    ストーリーの読み書きも1件ずつの操作なので、行の操作と同じ場所に置く。
 *
 * ⚠️ **公開プロフィール（`/u/[id]`）には渡さない。** `MergedTimeline` は共有部品で、
 *    `renderCareerExtra` を渡した画面にだけ出る。`viewerIsOwner` で出し分けては
 *    いけない（本人が自分の公開ページを見たときも true になる）。
 *
 * ⚠️ 2026-08-16 の 2-6 で `CareerHistoryEditor` の自前の一覧を差し替えたとき、
 *    その中にあった `<StoryAccordion>` が一緒に消え、**入口が1週間なくなっていた。**
 */
export default function CareerDetails({ initialExperiences, roles, roleAliases, companyLogoInfo, birthDate }: {
  initialExperiences: Stint[];
  roles: { id: string; name: string; parent_id: string | null; display_order: number }[];
  roleAliases: Record<string, string[]>;
  companyLogoInfo: ({ id: string } & CompanyLogoInfo)[];
  birthDate: string | null;
}) {
  const [stints, setStints] = useState<Stint[]>(initialExperiences);
  const [addNonce, setAddNonce] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [addRoleForId, setAddRoleForId] = useState<string | null>(null);

  const careers = useMemo(
    () => stintsToCareerEntries(stints, companyLogoInfo, roles),
    [stints, companyLogoInfo, roles],
  );

  return (
    <DetailsFrame title="職歴" addLabel="職歴を追加" onAdd={() => setAddNonce((n) => n + 1)}>
      {stints.length === 0 ? (
        <DetailsEmpty label="職歴" onAdd={() => setAddNonce((n) => n + 1)} />
      ) : (
        <MergedTimeline
          careers={careers}
          educations={[]}
          future={null}
          viewerIsOwner
          birthDate={birthDate ?? undefined}
          careerActions={{
            onEditRow:   (id) => setEditId(id),
            onDeleteRow: (id) => setDeleteId(id),
            onAddRole:   (id) => setAddRoleForId(id),
          }}
          /* ★経歴ストーリー。職歴1件ごとに行の下へ畳んで置く（既定は閉じている） */
          renderCareerExtra={(careerId) => <StoryAccordion experienceId={careerId} />}
        />
      )}

      <CareerHistoryEditor
        openAddNonce={addNonce}
        openEditId={editId}
        openDeleteId={deleteId}
        openAddRoleForCareerId={addRoleForId}
        onClosed={() => { setEditId(null); setDeleteId(null); setAddRoleForId(null); }}
        onStintsChange={setStints}
        initialExperiences={initialExperiences}
        roles={roles}
        roleAliases={roleAliases}
      />
    </DetailsFrame>
  );
}
