/**
 * メールアドレスのドメインから「その企業の人かどうか」を推し量るための道具（2026-09-04）。
 *
 * ⚠️★**これは判定ではなく材料。** 一致しても本人である保証は無いし、
 *    一致しなくても本人でないとは限らない（採用担当が個人アドレスで登録する、
 *    採用サイトだけ別ドメイン、持株会社と事業会社でドメインが違う、など）。
 *    **自動で承認・却下する条件に使わないこと。** 人が見て判断するために出す。
 *
 * ⚠️ フリーメールを弾くのは「会社のドメインと一致しうるか」を見たいだけ。
 *    フリーメールの利用者を不審者として扱わない。
 */

/** ⚠️ 増やすときはここだけ。呼び出し側に書き写さない（`/biz/companies/add/new` に直書きされていた） */
export const FREE_EMAIL_DOMAINS = [
  "gmail.com", "googlemail.com", "yahoo.co.jp", "yahoo.com",
  "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com",
];

/** メールアドレスのドメイン（小文字）。フリーメールと不正な値は null */
export function corporateDomainOfEmail(email: string | null | undefined): string | null {
  const d = (email ?? "").split("@")[1]?.trim().toLowerCase();
  if (!d || !d.includes(".")) return null;
  return FREE_EMAIL_DOMAINS.includes(d) ? null : d;
}

/** 企業サイトの URL からホスト名（小文字・`www.` は落とす）。取れなければ null */
export function domainOfUrl(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * メールのドメインが企業サイトのドメインと重なるか。
 *
 * ⚠️ 完全一致だけでなく、**どちらかがもう一方のサブドメイン**なら一致とみなす
 *    （`salesforce.com` と `www.salesforce.com` / `jp.example.com` と `example.com`）。
 * ⚠️ 判定できないときは `null` を返す。**`false` に倒さない** ——
 *    「一致しなかった」と「そもそも比べられなかった」を混ぜると、
 *    URL 未登録の企業がすべて怪しく見える。
 */
export function emailMatchesCompanyDomain(
  email: string | null | undefined,
  companyUrl: string | null | undefined,
): boolean | null {
  const mail = corporateDomainOfEmail(email);
  const site = domainOfUrl(companyUrl);
  if (!mail || !site) return null;
  return mail === site || mail.endsWith(`.${site}`) || site.endsWith(`.${mail}`);
}
