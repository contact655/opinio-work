/**
 * ★企業ページの本文のセクション（2026-11-26 / 柴さんの指示。フェーズ2）。
 *   事業内容／ミッション・カルチャー／働き方／福利厚生／公式の発信。
 *
 * ⚠️ 文章は各企業が自分で入力したもの（または運営が出典から入れたもの）をそのまま出す。ここで文章を作らない。
 * ⚠️ 値が空の行・セクションは出さない（DefinitionRows が空の行を落とす。全部空ならセクションごと null）。
 * ⚠️ company_features は出さない（2026-11-26 時点の値はすべて migration の一括投入で、企業の入力ではない）。
 * ⚠️ 職歴ごとの入社後レビューの回答・「社員の声」の類いは出さない。
 * ⚠️ style タグの中に不等号・バッククォート・引用符を書かない（ハイドレーションが壊れる）。
 */
import type { Company } from "@/app/companies/mockCompanies";
import type { CompanyDetail } from "@/app/companies/[id]/mockDetailData";
import type { CompanyPhoto } from "@/lib/supabase/queries";
import { orderedBusinessDomains } from "@/types/genre";
import { splitParenSuffix } from "@/lib/utils/parenSuffix";
import { WORK_STYLE_LABELS } from "@/lib/constants/workStyle";
import { Markdown } from "@/components/common/Markdown";
import { DefinitionRows } from "@/components/detail/DefinitionRows";
import { SectionCard } from "@/components/detail/SectionCard";
import { PhotoCarousel } from "./PhotoCarousel";

/** 主な製品を最初に出す数（残りは「ほかN製品を見る」） */
const PRODUCTS_VISIBLE = 4;

export const PROFILE_CSS = `
  .cp-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
  .cp-tag { display: inline-block; padding: 3px 10px; border-radius: 999px; background: var(--bg-tint); border: 1px solid var(--line); font-size: 13px; line-height: 1.6; color: var(--ink); }
  .cp-list { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
  .cp-prod-name { font-weight: 700; }
  .cp-prod-sub { color: var(--ink-soft); margin-left: 10px; }
  .cp-more summary { list-style: none; cursor: pointer; display: inline-block; margin-top: 6px; font-size: 14px; font-weight: 700; color: var(--royal); }
  .cp-more summary::-webkit-details-marker { display: none; }
  .cp-more[open] summary { display: none; }
  .cp-case { padding: 10px 0; }
  .cp-case + .cp-case { border-top: 1px solid var(--line-soft); }
  .cp-boxes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .cp-box { border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: var(--bg-tint); min-width: 0; }
  .cp-box-label { font-size: 12.5px; font-weight: 700; color: var(--ink-mute); }
  .cp-box-value { margin-top: 4px; font-size: 15px; font-weight: 700; color: var(--ink); line-height: 1.6; overflow-wrap: anywhere; }
  .cp-links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .cp-link { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; text-decoration: none; color: var(--ink); background: #fff; min-width: 0; }
  .cp-link-mark { flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; }
  .cp-link-kind { display: block; font-size: 12px; font-weight: 700; color: var(--ink-mute); }
  .cp-link-name { display: block; font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 640px) {
    .cp-boxes { grid-template-columns: minmax(0, 1fr); }
    .cp-links { grid-template-columns: minmax(0, 1fr); }
    .cp-prod-sub { display: block; margin-left: 0; }
  }
`;

function Tags({ items }: { items: string[] }) {
  return (
    <ul className="cp-tags">
      {items.map((t) => <li key={t} className="cp-tag">{t}</li>)}
    </ul>
  );
}

// ─── 1. 事業内容 ─────────────────────────────────────────────────────────────

export function hasBusinessSection(company: Company, detail: CompanyDetail, photos: CompanyPhoto[]): boolean {
  return !!(detail.about || orderedBusinessDomains(company.business_domains).length > 0 || detail.main_products?.length
    || detail.main_customers?.length || detail.main_sales_targets?.length || detail.customer_cases?.length || photos.length > 0);
}

export function BusinessSection({ company, detail, photos }: { company: Company; detail: CompanyDetail; photos: CompanyPhoto[] }) {
  if (!hasBusinessSection(company, detail, photos)) return null;
  const domains = orderedBusinessDomains(company.business_domains).map((d) => d.name);
  const products = (detail.main_products ?? []).map(splitParenSuffix);
  const cases = (detail.customer_cases ?? []).filter((c) => c && c.name);

  const productLine = (p: { name: string; sub: string | null }, i: number) => (
    <li key={`${p.name}-${i}`}><span className="cp-prod-name">{p.name}</span>{p.sub && <span className="cp-prod-sub">{p.sub}</span>}</li>
  );

  return (
    <SectionCard id="business" state="company-business" title="事業内容">
      {photos.length > 0 && <div style={{ marginBottom: 16 }}><PhotoCarousel photos={photos} /></div>}
      <DefinitionRows ariaLabel="事業内容" rows={[
        /* ⚠️ markdown として描画する（入力欄が markdown エディタ。2026-08-26） */
        { label: "事業概要", value: detail.about ? <Markdown>{detail.about}</Markdown> : null },
        { label: "事業領域", value: domains.length > 0 ? <Tags items={domains} /> : null },
        { label: "主な製品", value: products.length > 0 ? (
          <>
            <ul className="cp-list">{products.slice(0, PRODUCTS_VISIBLE).map(productLine)}</ul>
            {products.length > PRODUCTS_VISIBLE && (
              <details className="cp-more">
                <summary>ほか{products.length - PRODUCTS_VISIBLE}製品を見る →</summary>
                <ul className="cp-list" style={{ marginTop: 6 }}>{products.slice(PRODUCTS_VISIBLE).map((p, i) => productLine(p, i + PRODUCTS_VISIBLE))}</ul>
              </details>
            )}
          </>
        ) : null },
        /* ⚠️ 顧客（企業名・顧客区分）と営業先（顧客企業の中の部署）は別の項目。混ぜない */
        { label: "主な顧客", value: detail.main_customers?.length ? detail.main_customers.join("、") : null },
        { label: "主な営業先", value: detail.main_sales_targets?.length ? detail.main_sales_targets.join("、") : null },
        { label: "導入企業", value: cases.length > 0 ? (
          <>
            <span>{cases[0].name}{cases.length > 1 ? " ほか" : ""}</span>
            <details className="cp-more" style={{ display: "block" }}>
              <summary>導入事例{cases.length}社を見る →</summary>
              <div style={{ marginTop: 4 }}>
                {cases.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="cp-case" data-state="customer-case">
                    <div style={{ fontWeight: 700 }}>{c.name}{c.industry && <span style={{ fontWeight: 400, color: "var(--ink-mute)", marginLeft: 8, fontSize: 13 }}>{c.industry}</span>}</div>
                    {c.usecase && <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>{c.usecase}</div>}
                    {c.result && <div style={{ fontSize: 14 }}>成果：{c.result}</div>}
                  </div>
                ))}
              </div>
            </details>
          </>
        ) : null },
      ]} />
    </SectionCard>
  );
}

// ─── 2. ミッション・カルチャー ───────────────────────────────────────────────

export function hasMissionSection(detail: CompanyDetail): boolean {
  return !!(detail.mission || detail.culture_description || detail.culture_keywords?.length || detail.ceoMessage);
}

export function MissionSection({ detail }: { detail: CompanyDetail }) {
  if (!hasMissionSection(detail)) return null;
  return (
    <SectionCard id="mission" state="company-mission" title="ミッション・カルチャー">
      <DefinitionRows ariaLabel="ミッション・カルチャー" rows={[
        { label: "ミッション", value: detail.mission ? <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.7 }}>{detail.mission}</span> : null },
        { label: "カルチャー", value: detail.culture_description },
        { label: "大切にしていること", value: detail.culture_keywords?.length ? <Tags items={detail.culture_keywords} /> : null },
        { label: "代表メッセージ", value: detail.ceoMessage ?? null },
      ]} />
    </SectionCard>
  );
}

// ─── 6. 働き方 ───────────────────────────────────────────────────────────────

type WorkBox = { key: string; label: string; value: string };

/** 働き方の要点（最大3つ）。⚠️ 企業が入力欄で入れられる値だけ（勤務時間制度・リモート） */
export function workstyleBoxes(detail: CompanyDetail): WorkBox[] {
  const boxes: WorkBox[] = [];
  if (detail.workTimeSystem) boxes.push({ key: "time", label: "勤務時間", value: detail.workTimeSystem });
  if (detail.remoteWorkStatus) boxes.push({ key: "remote", label: "リモート", value: WORK_STYLE_LABELS[detail.remoteWorkStatus] ?? detail.remoteWorkStatus });
  return boxes.slice(0, 3);
}

export function WorkstyleSection({ detail }: { detail: CompanyDetail }) {
  const boxes = workstyleBoxes(detail);
  if (boxes.length === 0) return null;
  return (
    <SectionCard id="workstyle" state="company-workstyle" title="働き方">
      <div className="cp-boxes">
        {boxes.map((b) => (
          <div key={b.key} className="cp-box">
            <div className="cp-box-label">{b.label}</div>
            <div className="cp-box-value">{b.value}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── 7. 福利厚生 ─────────────────────────────────────────────────────────────

/** 働き方に出した項目と重なる福利厚生（フレックス・リモート）を除く */
export function benefitTags(detail: CompanyDetail): { name: string; detail?: string }[] {
  const boxes = workstyleBoxes(detail);
  const hasTime = boxes.some((b) => b.key === "time");
  const hasRemote = boxes.some((b) => b.key === "remote");
  return (detail.benefits ?? []).filter((b) => {
    if (hasTime && /フレックス|裁量労働/.test(b.name)) return false;
    if (hasRemote && /リモート|在宅|テレワーク/.test(b.name)) return false;
    return true;
  });
}

export function BenefitTagsSection({ detail }: { detail: CompanyDetail }) {
  const items = benefitTags(detail);
  if (items.length === 0) return null;
  return (
    <SectionCard id="benefits" state="company-benefits" title="福利厚生">
      <ul className="cp-tags">
        {/* 補足（detail）は押さずに読めるよう括弧で続ける */}
        {items.map((b) => <li key={b.name} className="cp-tag">{b.detail ? `${b.name}（${b.detail}）` : b.name}</li>)}
      </ul>
    </SectionCard>
  );
}

// ─── 9. 公式の発信 ───────────────────────────────────────────────────────────

export type ExternalLink = { id: string; url: string; title: string | null; source_name: string | null; type: string | null };

/** URL のホストから種類を決める。分からなければ記事の種類（type）から */
function linkKind(l: ExternalLink): { label: string; mark: string; color: string } {
  let host = "";
  try { host = new URL(l.url).hostname.replace(/^www\./, ""); } catch { /* 下で既定に倒す */ }
  if (/(^|\.)x\.com$|twitter\.com$/.test(host)) return { label: "X", mark: "X", color: "#000" };
  if (/linkedin\.com$/.test(host)) return { label: "LinkedIn", mark: "in", color: "#0A66C2" };
  if (/youtube\.com$|youtu\.be$/.test(host)) return { label: "YouTube", mark: "▶", color: "#FF0000" };
  if (/facebook\.com$/.test(host)) return { label: "Facebook", mark: "f", color: "#1877F2" };
  if (/instagram\.com$/.test(host)) return { label: "Instagram", mark: "IG", color: "#C13584" };
  if (/note\.com$/.test(host)) return { label: "note", mark: "n", color: "#41C9B4" };
  return { label: l.type === "video" ? "動画" : "ブログ", mark: "B", color: "var(--royal)" };
}

/** 表示するアカウント名。「X @SalesforceJapan」のように先頭に種類が付いていれば外す */
function accountName(l: ExternalLink, kindLabel: string): string {
  const raw = (l.source_name || l.title || l.url).trim();
  return raw.startsWith(kindLabel + " ") ? raw.slice(kindLabel.length + 1) : raw;
}

export function ExternalLinksSection({ links }: { links: ExternalLink[] }) {
  if (links.length === 0) return null;
  return (
    <SectionCard id="official-links" state="company-official-links" title="公式の発信">
      <div className="cp-links">
        {links.map((l) => {
          const k = linkKind(l);
          return (
            <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="cp-link" data-state="official-link">
              <span className="cp-link-mark" aria-hidden style={{ background: k.color }}>{k.mark}</span>
              <span style={{ minWidth: 0 }}>
                <span className="cp-link-kind">{k.label}</span>
                <span className="cp-link-name">{accountName(l, k.label)}</span>
              </span>
            </a>
          );
        })}
      </div>
    </SectionCard>
  );
}
