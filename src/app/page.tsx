import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";

export default async function Home() {
  const profile = await getCurrentProfile();
  redirect(profile ? ROLE_HOME[profile.role] : "/login");
}
