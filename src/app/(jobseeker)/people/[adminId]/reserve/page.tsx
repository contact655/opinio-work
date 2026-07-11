import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AmbassadorReserveClient } from "./AmbassadorReserveClient";

type Props = { params: { adminId: string } };

type DbRow = {
  id: string;
  role_title: string | null;
  department: string | null;
  talk_themes: string[] | null;
  user: { id: string; name: string | null; avatar_color: string | null; avatar_url: string | null } | null;
  company: { id: string; name: string | null; brand_name: string | null; logo_url: string | null; logo_gradient: string | null; logo_letter: string | null } | null;
};

async function getAmbassador(adminId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ow_company_admins")
    .select(`
      id, role_title, department, talk_themes,
      user:ow_users!user_id(id, name, avatar_color, avatar_url),
      company:ow_companies!company_id(id, name, brand_name, logo_url, logo_gradient, logo_letter)
    `)
    .eq("id", adminId)
    .eq("is_ambassador", true)
    .eq("is_active", true)
    .maybeSingle();
  return data as unknown as DbRow | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getAmbassador(params.adminId);
  if (!a) return {};
  const name = a.user?.name ?? "先輩";
  const co = (a.company as { brand_name: string | null; name: string | null } | null)?.brand_name ?? (a.company as { name: string | null } | null)?.name ?? "";
  return {
    title: `${name}（${co}）に話を聞く | OPINIO`,
    description: `${co}の${name}さんに、キャリアや職場のリアルを直接相談できます。完全無料・OPINIO編集部が仲介します。`,
  };
}

export default async function AmbassadorReservePage({ params }: Props) {
  const ambassador = await getAmbassador(params.adminId);
  if (!ambassador) notFound();

  const FALLBACK = "linear-gradient(135deg, #002366, #3B5FD9)";
  const gradient = (ambassador.user?.avatar_color?.startsWith("linear-gradient")
    ? ambassador.user.avatar_color : FALLBACK) ?? FALLBACK;

  return (
    <AmbassadorReserveClient
      adminId={ambassador.id}
      name={ambassador.user?.name ?? "先輩"}
      initial={(ambassador.user?.name ?? "?").charAt(0)}
      gradient={gradient}
      avatarUrl={ambassador.user?.avatar_url ?? null}
      roleTitle={ambassador.role_title}
      companyName={(ambassador.company as { brand_name: string | null; name: string | null } | null)?.brand_name ?? (ambassador.company as { name: string | null } | null)?.name ?? ""}
      talkThemes={ambassador.talk_themes ?? []}
    />
  );
}
