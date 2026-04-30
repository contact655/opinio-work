import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteClient } from "./AcceptInviteClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "招待を受諾 | Opinio Business",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXPIRY_DAYS = 7;

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  // Token format validation
  if (!token || !UUID_RE.test(token)) {
    return <AcceptInviteClient state="invalid" />;
  }

  const admin = createAdminClient();

  // Token lookup (admin client to bypass RLS — user_id IS NULL rows are invisible to normal client)
  const { data: inviteRow } = await admin
    .from("ow_company_admins")
    .select("id, company_id, invited_email, invited_at")
    .eq("invitation_token", token)
    .is("user_id", null)
    .maybeSingle();

  if (!inviteRow) {
    return <AcceptInviteClient state="invalid" />;
  }

  // Expiry check
  const expiresAt = new Date(
    new Date(inviteRow.invited_at).getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000
  );
  if (Date.now() > expiresAt.getTime()) {
    return <AcceptInviteClient state="expired" />;
  }

  // Fetch company name
  const { data: company } = await admin
    .from("ow_companies")
    .select("name")
    .eq("id", inviteRow.company_id)
    .maybeSingle();
  const companyName = company?.name ?? "(不明)";

  // Auth check
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AcceptInviteClient
        state="unauthenticated"
        token={token}
        invitedEmail={inviteRow.invited_email ?? ""}
        companyName={companyName}
      />
    );
  }

  // Email match check
  const loggedInEmail = (user.email ?? "").toLowerCase().trim();
  const invitedEmail = (inviteRow.invited_email ?? "").toLowerCase().trim();

  if (loggedInEmail !== invitedEmail) {
    return (
      <AcceptInviteClient
        state="mismatch"
        invitedEmail={inviteRow.invited_email ?? ""}
        loggedInEmail={user.email ?? ""}
        token={token}
      />
    );
  }

  return (
    <AcceptInviteClient
      state="ready"
      token={token}
      companyName={companyName}
    />
  );
}
