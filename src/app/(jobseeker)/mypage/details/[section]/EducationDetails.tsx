"use client";

import { useState } from "react";
import MergedTimeline from "@/components/profile/MergedTimeline";
import { EducationEditor } from "@/components/profile/editor/RecordEditors";
import { RowActionButtons } from "@/components/profile/view/RowActions";
import { toTimelineEducationEntries, type RawEducation } from "@/lib/utils/timeline";
import type { Education, School } from "@/components/profile/editor/recordTypes";
import { DetailsFrame, DetailsEmpty } from "./DetailsFrame";

/**
 * 学歴の一覧ページ（2026-08-17 / フェーズ3）。
 *
 * ⚠️ **行の表示は `/mypage` 本体と同じ `MergedTimeline`。** ここで描き直さない。
 *    違うのは「全件出す」ことと「行ごとの鉛筆・ゴミ箱を出す」ことだけ。
 * ⚠️ 編集・削除は本体と同じ `EducationEditor`（モーダル＋確認ダイアログ）を使う。
 */
export default function EducationDetails({ initialEducations, schools }: {
  initialEducations: Education[];
  schools: School[];
}) {
  const [educations, setEducations] = useState<Education[]>(initialEducations);
  const [addNonce, setAddNonce] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const actions = {
    onEditRow:   (id: string) => setEditingId(id),
    onDeleteRow: (id: string) => setDeleteId(id),
  };

  return (
    <DetailsFrame title="学歴" addLabel="学歴を追加" onAdd={() => { setEditingId(null); setAddNonce((n) => n + 1); }}>
      {educations.length === 0 ? (
        <DetailsEmpty label="学歴" onAdd={() => { setEditingId(null); setAddNonce((n) => n + 1); }} />
      ) : (
        <>
          <MergedTimeline
            careers={[]}
            educations={toTimelineEducationEntries(educations as RawEducation[])}
            educationActions={actions}
          />
          {/* ⚠️ `toTimelineEducationEntries` は**入学年月が無い行を落とす**（年表に置けない）。
                 ここで拾わないと、その行はどの画面からも触れなくなる（2026-08-16 / 2-5）。
                 本体は N件までしか出さないので、**拾う場所はこのページだけ**になった。 */}
          {educations.filter((e) => !e.enrolled_at).map((e) => (
            <div key={e.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{e.school}</div>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 3, lineHeight: 1.7 }}>
                  入学年月が未入力のため、公開プロフィールには表示されていません。
                </div>
              </div>
              <RowActionButtons id={e.id} label={e.school} actions={actions} />
            </div>
          ))}
        </>
      )}

      <EducationEditor
        educations={educations}
        setEducations={setEducations}
        schools={schools}
        openAddNonce={addNonce}
        openEditId={editingId}
        openDeleteId={deleteId}
        onClosed={() => { setEditingId(null); setDeleteId(null); }}
      />
    </DetailsFrame>
  );
}
