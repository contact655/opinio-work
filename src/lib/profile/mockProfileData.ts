export type CompanyType = "master" | "custom" | "anon";

export type Experience = {
  id: string;
  companyType: CompanyType;
  companyId?: string;        // master
  companyText?: string;      // custom
  companyAnonymized?: string; // anon
  displayCompanyName: string; // computed for display
  roleCategoryId: string;
  roleTitle?: string;
  startedAt: string;         // "YYYY-MM"
  endedAt?: string;          // "YYYY-MM", undefined = current
  isCurrent: boolean;
  description?: string;
};

export type SocialLinks = {
  twitter?: string;
  linkedin?: string;
  note?: string;
};

/* ⚠️★`LOCATIONS`（9都道府県＋海外＋非公開の11件）は **2026-09-15 に削除した。**
      `/mypage` の「所在地」だけがこれを見ており、`/mypage/settings` の「居住地」は
      47件の側を見ていて、**同じ `ow_users.location` に別の語彙を書いていた。**
      いまの正は [lib/utils/location.ts](../utils/location.ts) の `RESIDENCE_OPTION_GROUPS`
      （47都道府県＋「海外」「非公開」）**1箇所だけ**。⚠️ ここに書き戻さないこと。 */

