"use client";

import { Variant } from "../Variant";
import { HiringBadgeChip } from "@/app/(jobseeker)/people/PeopleListClient";
import { PrivateMessageNote } from "@/components/nextManager/PrivateMessageNote";
import { ManagerMatchPanel, type ManagerPanelSample } from "@/components/nextManager/ManagerMatchPanel";
import ManagerMatchesClient from "@/app/biz/(app)/manager-matches/ManagerMatchesClient";
import { privateMessageNote, hiringForText } from "@/lib/nextManager/constants";
import type { CompanyMatchesView } from "@/lib/nextManager/server";

const PANEL: ManagerPanelSample = {
  id: "m1", companyName: "株式会社エージェント", candidateName: "田中 美咲", matchedAt: "2026-11-05T03:00:00Z",
  jobId: null, metOn: "2026-11-10", result: "next_step", memo: "IS立ち上げの経験が豊富。チームの石井さんとも会ってもらう。",
  jobs: [{ id: "j1", title: "フィールドセールス", status: "published" }, { id: "j2", title: "インサイドセールス リーダー", status: "draft" }],
};

const VIEW: CompanyMatchesView = {
  rows: [
    { id: "r1", candidateId: "u1", candidateName: "田中 美咲", managerId: "a", managerName: "山本 健", managerLeft: false, handedOverFromName: null, handedOverFromLeft: false, matchedAt: "2026-11-05T00:00:00Z", metOn: "2026-11-10", result: "next_step", memo: "IS立ち上げの経験が豊富。チームの石井さんとも会ってもらう。", jobTitle: "フィールドセールス" },
    { id: "r2", candidateId: "u2", candidateName: "井上 亮", managerId: "a", managerName: "山本 健", managerLeft: false, handedOverFromName: null, handedOverFromLeft: false, matchedAt: "2026-11-01T00:00:00Z", metOn: "2026-11-06", result: "continue", memo: "転職は来年春以降の想定。定期的に情報交換する。", jobTitle: null },
    { id: "r3", candidateId: "u3", candidateName: "加藤 千尋", managerId: "b", managerName: "石井 恵", managerLeft: false, handedOverFromName: null, handedOverFromLeft: false, matchedAt: "2026-11-08T00:00:00Z", metOn: null, result: null, memo: null, jobTitle: null },
    { id: "r4", candidateId: "u4", candidateName: "松井 隼人", managerId: "a", managerName: "山本 健", managerLeft: false, handedOverFromName: "鈴木 拓也", handedOverFromLeft: true, matchedAt: "2026-08-20T00:00:00Z", metOn: "2026-08-28", result: "hired", memo: "10月入社。", jobTitle: null },
    { id: "r5", candidateId: "u5", candidateName: "原 悠真", managerId: "c", managerName: "佐藤 一郎", managerLeft: true, handedOverFromName: null, handedOverFromLeft: false, matchedAt: "2026-08-12T00:00:00Z", metOn: "2026-08-19", result: "declined", memo: "希望年収と合わず。1年後にもう一度声をかけたい。とても長いメモがここに入っても折り返して表示されることを確かめるための文です。".repeat(2), jobTitle: null },
  ],
  managers: [
    { userId: "a", name: "山本 健", department: "セールス部", hiring: true, left: false, matchCount: 3, handedOverToName: null },
    { userId: "b", name: "石井 恵", department: "CS部", hiring: true, left: false, matchCount: 1, handedOverToName: null },
    { userId: "c", name: "佐藤 一郎", department: null, hiring: false, left: true, matchCount: 1, handedOverToName: null },
    { userId: "d", name: "鈴木 拓也", department: null, hiring: false, left: true, matchCount: 0, handedOverToName: "山本 健" },
  ],
  successors: [{ userId: "a", name: "山本 健" }, { userId: "b", name: "石井 恵" }],
};

export function NextManagerSamples() {
  return (
    <>
      <Variant label="ユーザー一覧の「採用中」のバッジと「チームで募集中」">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 800 }}>山本 健</span><HiringBadgeChip companyName="株式会社エージェント" />
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>チームで募集中: {hiringForText({ note: "2名", jobTitle: "フィールドセールス" })}</span>
        </div>
      </Variant>
      <Variant label="送る画面の一行／メッセージ画面の上部の一行">
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <PrivateMessageNote text={privateMessageNote("山本 健", "田中 美咲")} />
          <div style={{ border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}><PrivateMessageNote compact /></div>
        </div>
      </Variant>
      <Variant label="面談の記録（担当マネージャー本人にだけ出る）">
        <div style={{ maxWidth: 720, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
          <ManagerMatchPanel conversationId="sample" sample={PANEL} />
        </div>
      </Variant>
      <Variant label="候補者管理（管理者・全件。退職と引き継ぎを含む）">
        <ManagerMatchesClient view={VIEW} viewAll canHandover />
      </Variant>
      <Variant label="候補者管理（自分の分だけ）">
        <ManagerMatchesClient view={{ ...VIEW, rows: VIEW.rows.filter((r) => r.managerId === "b"), managers: VIEW.managers.filter((m) => m.userId === "b") }} viewAll={false} canHandover={false} />
      </Variant>
      <Variant label="候補者管理（0件）">
        <ManagerMatchesClient view={{ rows: [], managers: [], successors: [] }} viewAll canHandover />
      </Variant>
      <Variant label="候補者管理（読み込み失敗）">
        <ManagerMatchesClient view={null} viewAll canHandover />
      </Variant>
    </>
  );
}
