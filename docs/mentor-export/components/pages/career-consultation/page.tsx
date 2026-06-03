import { JobseekerHeader } from "@/components/jobseeker/JobseekerHeader";
import { JobseekerFooter } from "@/components/jobseeker/JobseekerFooter";
import { createClient } from "@/lib/supabase/server";
import CareerConsultationClient from "./CareerConsultationClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "キャリア相談 | OPINIO",
  description:
    "現役SaaS実務家10名に無料で転職相談。営業・CS・マーケの現役プロが転職のリアルを正直に話します。",
  alternates: { canonical: "/career-consultation" },
  openGraph: {
    title: "キャリア相談 | OPINIO",
    description: "現役SaaS実務家10名に無料で転職相談。営業・CS・マーケのプロが転職のリアルを正直に話します。",
    url: "https://opinio.jp/career-consultation",
    type: "website",
  },
};

async function getMentors() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("ow_mentors")
      .select("*")
      .eq("is_available", true)
      .order("display_order", { ascending: true });
    if (error) {
      console.error("[career-consultation] mentors fetch error:", error.message);
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

async function getUserProfile(userId: string) {
  const supabase = createClient();
  try {
    const { data } = await supabase
      .from("ow_profiles")
      .select("job_type, experience_years, worry")
      .eq("user_id", userId)
      .single();
    return data;
  } catch {
    return null;
  }
}

export default async function CareerConsultationPage() {
  const supabase = createClient();
  const mentors = await getMentors();

  // Get current user & profile
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  let userProfile = null;
  if (user) {
    userProfile = await getUserProfile(user.id).catch(() => null);
  }

  return (
    <>
      <JobseekerHeader />
      <main className="pt-16 min-h-screen bg-white">
        <CareerConsultationClient
          mentors={mentors}
          isLoggedIn={isLoggedIn}
          userProfile={userProfile}
        />
      </main>
      <JobseekerFooter />
    </>
  );
}
