import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/session";

export default async function RootPage() {
  const context = await getSessionContext();

  if (!context) redirect("/login");
  if (!context.activeOrganization) redirect("/onboarding");
  redirect("/app");
}
