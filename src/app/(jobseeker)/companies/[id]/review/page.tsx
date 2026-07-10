import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import ReviewForm from "./ReviewForm";

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props) {
  const admin = createAdminClient();
  const { data } = await admin.from("ow_companies").select("name").eq("id", params.id).single();
  return { title: { absolute: `${data?.name ?? "企業"} の口コミを書く | OPINIO` } };
}

export default async function ReviewPage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?next=/companies/${params.id}/review`);

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("ow_companies")
    .select("id, name, industry, phase")
    .eq("id", params.id)
    .single();

  if (!company) redirect("/companies");

  return <ReviewForm company={company} />;
}
