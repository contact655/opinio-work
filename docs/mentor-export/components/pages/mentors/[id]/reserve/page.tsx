import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMentorById } from "@/lib/supabase/queries";
import ReserveForm from "./ReserveForm";

type Props = { params: { id: string } };

export default async function MentorReservePage({ params }: Props) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/mentors/${params.id}/reserve`);
  }

  const mentor = await getMentorById(params.id);
  if (!mentor) notFound();

  const userEmail = user.email ?? "";

  return <ReserveForm mentor={mentor} userEmail={userEmail} />;
}
