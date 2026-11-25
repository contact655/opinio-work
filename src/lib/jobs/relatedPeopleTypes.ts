/**
 * 求人ページ「この募集に関わる人」の型と文言（2026-11-26）。何も import しない（ブラウザからも読む）。
 * 中身を作るのは lib/jobs/relatedPeople.ts（サーバー専用）。
 */
export type RelatedRole = "recruiter" | "manager" | "member";

export type RelatedPerson = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  /** 肩書き（採用担当は部門・職種、マネージャーは見出し、メンバーは社内での呼び方）。無ければ null */
  title: string | null;
  /** 並びの順に入る。同じ人が2つの役割に当たれば2つ */
  roles: RelatedRole[];
  /** メッセージのボタンを出すか（採用担当・配属先マネージャーだけ）。送れるかは DMButton が確かめる */
  canMessage: boolean;
};

export const RELATED_ROLE_LABEL: Record<RelatedRole, string> = {
  recruiter: "採用担当",
  manager: "配属先マネージャー",
  member: "チームメンバー",
};

/** カードの見出し。採用担当しかいないときは今までと同じ「採用担当」 */
export function relatedPeopleTitle(people: RelatedPerson[]): string {
  return people.every((p) => p.roles.length === 1 && p.roles[0] === "recruiter") ? "採用担当" : "この募集に関わる人";
}
