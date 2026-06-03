import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";
import ConsultationCasesClient from "./ConsultationCasesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "相談事例 | OPINIO",
  description:
    "実際のキャリア相談事例を紹介。SIerからSaaS転職、年収交渉、キャリアチェンジなど、リアルな相談と気づきをご覧ください。",
  alternates: { canonical: "/consultation-cases" },
  openGraph: {
    title: "相談事例 | OPINIO",
    description: "SIerからSaaS転職、年収交渉、キャリアチェンジ——リアルな相談と気づきをご覧ください。",
    url: "https://opinio.jp/consultation-cases",
    type: "website",
  },
};

async function getCases() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("consultation_cases")
      .select("*, ow_mentors(name, current_role, current_company, avatar_initial, avatar_color)")
      .eq("is_published", true)
      .order("display_order", { ascending: true });
    if (error) {
      console.error("[consultation-cases] fetch error:", error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

export default async function ConsultationCasesPage() {
  const cases = await getCases();

  return (
    <>
      <JobseekerHeader />
      <main className="pt-16 min-h-screen" style={{ background: "#FAFAF9" }}>
        <ConsultationCasesClient cases={cases} />
      </main>
      <JobseekerFooter />
    </>
  );
}
