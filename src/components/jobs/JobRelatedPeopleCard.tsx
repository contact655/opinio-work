"use client";

import Link from "next/link";
import { DMButton } from "@/components/profile/DMButton";
import { RELATED_ROLE_LABEL, relatedPeopleTitle, type RelatedPerson } from "@/lib/jobs/relatedPeopleTypes";

/**
 * 求人ページのサイドバー「この募集に関わる人」の見た目（2026-11-26）。データは受け取るだけ（見本 /dev/preview/job-related-people）。
 *   並び: 採用担当 → 配属先マネージャー → チームメンバー（lib/jobs/relatedPeople.ts が並べて返す）
 *   各人: 役割（小さく）・写真（無ければ頭文字）・氏名・肩書き
 *
 * ⚠️ 採用担当しかいないときは見出しも役割の表示も今までの「採用担当」カードと同じ（relatedPeopleTitle）。
 * ⚠️★メッセージのボタンは canMessage の人だけ（採用担当・配属先マネージャー）。チームメンバーには付けない
 *    （本人は話すことに同意していない。2026-10-16 に「話を聞ける人」を撤去した判断）。送れるかは DMButton が確かめる。
 * ⚠️ 見出しに「話せる人」「話を聞ける」と書かない（同じ理由）。
 * ⚠️ プレビュー（/biz）ではメッセージのボタンを出さない（社内の人が自分たちに送る形になるため）。
 * ⚠️ メンバー（自分の職歴を登録した人）はプロフィールへのリンク。採用担当は今までどおりリンクにしない。
 */
function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={44} height={44} loading="lazy" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <span aria-hidden style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--line-soft)", color: "var(--ink-mute)", fontWeight: 700, fontSize: 16 }}>
      {name.charAt(0)}
    </span>
  );
}

export function JobRelatedPeopleCard({ people, preview, titleTag = "h2" }: { people: RelatedPerson[]; preview: boolean; titleTag?: "h2" | "h3" }) {
  if (people.length === 0) return null;
  const title = relatedPeopleTitle(people);
  const onlyRecruiters = title === "採用担当";
  const Title = titleTag;
  return (
    <div className="jd-card jd-side-card" data-state="job-related-people">
      <Title style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{title}</Title>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {people.map((p, i) => {
          const linkToProfile = p.roles.includes("manager") || p.roles.includes("member");
          const body = (
            <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar url={p.avatarUrl} name={p.name} />
              <span style={{ minWidth: 0 }}>
                {!onlyRecruiters && (
                  <span data-state="related-role" style={{ display: "block", fontSize: 11.5, fontWeight: 700, color: "var(--ink-mute)", lineHeight: 1.5 }}>
                    {p.roles.map((r) => RELATED_ROLE_LABEL[r]).join("／")}
                  </span>
                )}
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--ink)", overflowWrap: "anywhere" }}>{p.name}</span>
                {p.title && <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-mute)", overflowWrap: "anywhere" }}>{p.title}</span>}
              </span>
            </span>
          );
          return (
            <li key={p.userId} data-person={p.userId} style={{ display: "grid", gap: 8, padding: "10px 0", borderTop: i === 0 ? undefined : "1px solid var(--line-soft)" }}>
              {linkToProfile
                ? <Link href={`/u/${p.userId}`} style={{ textDecoration: "none", color: "inherit" }}>{body}</Link>
                : body}
              {p.canMessage && !preview && (
                <DMButton targetUserId={p.userId} targetName={p.name} variant="card" label="メッセージを送る" />
              )}
            </li>
          );
        })}
      </ul>
      {people.some((p) => p.roles.includes("manager")) && (
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.7 }}>
          配属先マネージャーとのメッセージは2人だけのもので、会社には共有されません。
        </p>
      )}
    </div>
  );
}
