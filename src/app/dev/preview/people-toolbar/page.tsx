import { Suspense } from "react";
import { PeopleListClient } from "@/app/(jobseeker)/people/PeopleListClient";
import type { DirectoryPerson } from "@/lib/people/directory";
import { devOnly } from "../guard";

/* ⚠️ 見本の人（固定データ）。上部の見え方を確かめるためだけなので、使わない項目は空にしてある */
const person = (i: number, name: string): DirectoryPerson => ({
  userId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`, name, initial: name.slice(0, 1), gradient: "linear-gradient(135deg,#1e3a8a,#3b5bdb)",
  avatarUrl: null, affiliation: { kind: "none" }, headline: null, roleName: "フィールドセールス", topRoleId: null, roleIds: [], companyIds: [],
  ageBand: null, hasForeignExperience: false,
} as unknown as DirectoryPerson);

/**
 * /people の上部（2026-11-12）。本物の PeopleListClient を、人が0人の固定データで描く（DB を読まない）。
 * ⚠️ 条件を付けた見え方は URL に ?role=…&foreign=1&consult=1 を足して見る（例: ?foreign=1&consult=1）。
 */
export default function PeopleToolbarPreview() {
  devOnly();
  return (
    /* ⚠️ 見本の本文幅（980px）から出して、本物と同じ幅（最大 1300px）で描く */
    <div style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}>
    <Suspense fallback={null}>
      <PeopleListClient
        ambassadors={[person(1, "山田 太郎"), person(2, "佐藤 花子")]}
        roleSlugToId={{}}
        roleAliases={[]}
        myUserId={null}
        followedUserIds={[]}
        followerUserIds={[]}
        sidebar={null}
        prevCareer={null}
        consultantUserIds={[]}
      />
    </Suspense>
    </div>
  );
}
