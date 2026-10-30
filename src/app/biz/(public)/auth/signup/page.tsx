import { redirect } from "next/navigation";

export default function SignupRedirect() {
  redirect("/biz/auth?mode=signup");
}
