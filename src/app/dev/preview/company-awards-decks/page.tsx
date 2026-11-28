import { devOnly } from "../guard";
import { Variant, PreviewHeader } from "../Variant";
import { AwardsSection, ExternalLinksSection, PROFILE_CSS, type ExternalLink } from "@/app/(jobseeker)/companies/[id]/CompanyProfileSections";
import type { Award } from "@/lib/companies/awards";
import { EditorsRoundTrip } from "./EditorsRoundTrip";

/**
 * ★企業ページの「受賞・認定」と「公式の発信」の会社紹介資料（2026-11-28）。固定データだけ。DB を読まない。
 */
const AWARDS: Award[] = [
  { name: "くるみん認定", issuer: "厚生労働省", year: 2024, url: "https://www.mhlw.go.jp/" },
  { name: "健康経営優良法人2026（大規模法人部門）", issuer: "経済産業省・日本健康会議", year: 2026, url: null },
  { name: "とても長い正式名称の受賞・認定の例。名称が長くても折り返して表示されることを確かめるための行です", issuer: "一般社団法人 とても長い名前の団体の例", year: 2020, url: null },
];

const LINKS: ExternalLink[] = [
  { id: "d1", type: "deck", title: "会社紹介資料 2026年版", url: "https://speakerdeck.com/example/company-deck-2026", source_name: null },
  { id: "d2", type: "deck", title: "エンジニア向け採用ピッチ資料", url: "https://www.docswell.com/s/example/engineer", source_name: null },
  { id: "s1", type: "social", title: "X @example", url: "https://x.com/example", source_name: "X @example" },
  { id: "a1", type: "article", title: "テックブログ", url: "https://note.com/example", source_name: "テックブログ" },
];

export default function CompanyAwardsDecksPreview() {
  devOnly();
  return (
    <div>
      <style>{PROFILE_CSS}</style>
      <PreviewHeader title="受賞・認定 と 会社紹介資料">企業ページと同じ部品に固定データを渡しています。</PreviewHeader>
      <Variant label="受賞・認定（新しい年から順。url があれば名称がリンク）"><AwardsSection items={AWARDS} /></Variant>
      <Variant label="公式の発信：会社紹介資料2件＋ほかのリンク"><ExternalLinksSection links={LINKS} /></Variant>
      <Variant label="公式の発信：会社紹介資料だけ"><ExternalLinksSection links={LINKS.slice(0, 1)} /></Variant>
      <Variant label="入力欄（/biz/company と同じ部品）→ 保存側の検証の結果"><EditorsRoundTrip /></Variant>
      <Variant label="0件（どちらも出ない）"><AwardsSection items={[]} /><ExternalLinksSection links={[]} /></Variant>
    </div>
  );
}
