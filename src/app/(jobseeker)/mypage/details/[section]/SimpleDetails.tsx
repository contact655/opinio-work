"use client";

import { useState } from "react";
import {
  ProfileAchievementsSection,
  ProfileAwardsSection,
  ProfileCertificationsSection,
  ProfileLanguagesSection,
  ProfileMediaSection,
  ProfileContentLinksSection,
} from "@/components/profile/view/ProfileSections";
import { AchievementEditor, AwardEditor, CertificationEditor, LanguageEditor, MediaAppearanceEditor, type ExperienceOption } from "@/components/profile/editor/RecordEditors";
import { ContentLinksEditor, type ContentLink } from "@/components/profile/editor/ContentLinksEditor";
import type { Achievement, Award, Certification, Language, MediaAppearance } from "@/components/profile/editor/recordTypes";
import { DetailsFrame } from "./DetailsFrame";

/**
 * 数値実績 / 受賞・表彰 / 資格 / 言語 / メディア掲載 / 発信コンテンツ の一覧ページ（2026-08-17 / フェーズ3）。
 *
 * ⚠️ **6つとも同じ形**（表示は公開部品、編集はエディタのモーダル）なので1ファイルにまとめた。
 *    ここで見た目を書かない。**行の描画は公開プロフィールと同じ部品**に任せる。
 *
 * ⚠️ 0件でも**行き止まりにしない**。公開部品が「まだ〇〇を登録していません。〇〇を追加する」を
 *    出す（`actions` を渡しているとき）ので、このページでは空状態を自前で描かない。
 */

/** 行の操作（鉛筆・ゴミ箱）と見出しの「追加」をまとめて作る */
function useRowState() {
  const [addNonce, setAddNonce] = useState(0);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  return {
    addNonce, editId, deleteId,
    openAdd: () => { setEditId(null); setAddNonce((n) => n + 1); },
    onClosed: () => { setEditId(null); setDeleteId(null); },
    actions: {
      onEditRow: (id: string) => setEditId(id),
      onDeleteRow: (id: string) => setDeleteId(id),
      onAdd: () => { setEditId(null); setAddNonce((n) => n + 1); },
    },
  };
}

export function AchievementsDetails({ initial, experienceOptions }: {
  initial: Achievement[];
  experienceOptions: ExperienceOption[];
}) {
  const [rows, setRows] = useState<Achievement[]>(initial);
  const st = useRowState();
  return (
    <DetailsFrame title="数値実績" addLabel="数値実績を追加" onAdd={st.openAdd} hideOwnHeading>
      <ProfileAchievementsSection achievements={rows} actions={st.actions} />
      <AchievementEditor
        achievements={rows}
        setAchievements={setRows}
        openAddNonce={st.addNonce}
        openEditId={st.editId}
        openDeleteId={st.deleteId}
        experienceOptions={experienceOptions}
        onClosed={st.onClosed}
      />
    </DetailsFrame>
  );
}

export function AwardsDetails({ initial, experienceOptions }: {
  initial: Award[];
  experienceOptions: ExperienceOption[];
}) {
  const [rows, setRows] = useState<Award[]>(initial);
  const st = useRowState();
  return (
    <DetailsFrame title="受賞・表彰" addLabel="受賞・表彰を追加" onAdd={st.openAdd} hideOwnHeading>
      <ProfileAwardsSection awards={rows} actions={st.actions} />
      <AwardEditor
        awards={rows}
        setAwards={setRows}
        openAddNonce={st.addNonce}
        openEditId={st.editId}
        openDeleteId={st.deleteId}
        experienceOptions={experienceOptions}
        onClosed={st.onClosed}
      />
    </DetailsFrame>
  );
}

/** 資格（2026-08-24）。⚠️ 職歴と紐づかないので `experienceOptions` を取らない */
export function CertificationsDetails({ initial }: { initial: Certification[] }) {
  const [rows, setRows] = useState<Certification[]>(initial);
  const st = useRowState();
  return (
    <DetailsFrame title="資格" addLabel="資格を追加" onAdd={st.openAdd} hideOwnHeading>
      <ProfileCertificationsSection certifications={rows} actions={st.actions} />
      <CertificationEditor
        certifications={rows}
        setCertifications={setRows}
        openAddNonce={st.addNonce}
        openEditId={st.editId}
        openDeleteId={st.deleteId}
        onClosed={st.onClosed}
      />
    </DetailsFrame>
  );
}

/** 言語（2026-08-24）。⚠️ 職歴と紐づかないので `experienceOptions` を取らない */
export function LanguagesDetails({ initial }: { initial: Language[] }) {
  const [rows, setRows] = useState<Language[]>(initial);
  const st = useRowState();
  return (
    <DetailsFrame title="言語" addLabel="言語を追加" onAdd={st.openAdd} hideOwnHeading>
      <ProfileLanguagesSection languages={rows} actions={st.actions} />
      <LanguageEditor
        languages={rows}
        setLanguages={setRows}
        openAddNonce={st.addNonce}
        openEditId={st.editId}
        openDeleteId={st.deleteId}
        onClosed={st.onClosed}
      />
    </DetailsFrame>
  );
}

export function MediaDetails({ initial }: { initial: MediaAppearance[] }) {
  const [rows, setRows] = useState<MediaAppearance[]>(initial);
  const st = useRowState();
  return (
    <DetailsFrame title="メディア掲載" addLabel="メディア掲載を追加" onAdd={st.openAdd} hideOwnHeading>
      <ProfileMediaSection mediaAppearances={rows} actions={st.actions} />
      <MediaAppearanceEditor
        mediaAppearances={rows}
        setMediaAppearances={setRows}
        openAddNonce={st.addNonce}
        openEditId={st.editId}
        openDeleteId={st.deleteId}
        onClosed={st.onClosed}
      />
    </DetailsFrame>
  );
}

export function ContentDetails({ initial }: { initial: ContentLink[] }) {
  const [rows, setRows] = useState<ContentLink[]>(initial);
  const st = useRowState();
  return (
    <DetailsFrame title="発信コンテンツ" addLabel="発信コンテンツを追加" onAdd={st.openAdd} hideOwnHeading>
      <ProfileContentLinksSection contentLinks={rows} viewerIsOwner actions={st.actions} />
      <ContentLinksEditor
        contentLinks={rows}
        setContentLinks={setRows}
        openAddNonce={st.addNonce}
        openEditId={st.editId}
        openDeleteId={st.deleteId}
        onClosed={st.onClosed}
      />
    </DetailsFrame>
  );
}
