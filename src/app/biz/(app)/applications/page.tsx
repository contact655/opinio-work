import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function BizApplicationsPage() {
  redirect("/biz/meetings?tab=applications");
}
