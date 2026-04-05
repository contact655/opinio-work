import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { createClient } from "@/lib/supabase/server";
import CareerConsultationClient from "./CareerConsultationClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "キャリア相談 | opinio.work",
  description:
    "現役SaaS実務家10名に無料で転職相談。営業・CS・マーケの現役プロが転職のリアルを正直に話します。",
};

async function getMentors() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from("mentors")
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

export default async function CareerConsultationPage() {
  const mentors = await getMentors();

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-white">
        <CareerConsultationClient mentors={mentors} />
      </main>
      <Footer />
    </>
  );
}
