import {
  Briefcase, Calculator, Cloud, CodeXml, Compass, FileSignature, Handshake, ListChecks, Megaphone,
  ShieldCheck, Sparkles, Users, type LucideIcon,
} from "lucide-react";

/**
 * ★事業領域のアイコン（2026-10-16 / トップページ「事業領域から探す」）。キーは事業領域の slug。
 * ⚠️ 無い slug は汎用のアイコン（かばん）で出す。新しい事業領域がトップに出てきたら、ここに足すかを決めること。
 * ⚠️ 色は付けない（親の color を使う）。事業領域ごとに色分けしない（ui-conventions の「色の役割」）。
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  ai: Sparkles,
  infra: Cloud,
  security: ShieldCheck,
  devtools: CodeXml,
  crm: Handshake,
  marketing: Megaphone,
  hr: Users,
  finance: Calculator,
  legal: FileSignature,
  collab: ListChecks,
  consulting: Compass,
};

export function BusinessDomainIcon({ slug, size = 20 }: { slug: string; size?: number }) {
  const Icon = ICONS[slug] ?? Briefcase;
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}
