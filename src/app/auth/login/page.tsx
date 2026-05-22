import { redirect } from "next/navigation";

export default function LoginRedirect({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next;
  const query = next ? `?mode=login&next=${encodeURIComponent(next)}` : "?mode=login";
  redirect(`/auth${query}`);
}
