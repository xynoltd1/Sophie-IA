import { requireOrganization } from "@/lib/auth/session";
import { AppHeader } from "@/components/nav/app-header";
import { BottomNav } from "@/components/nav/bottom-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { activeOrganization } = await requireOrganization();

  // Sophie ne peut pas encore repondre : la telephonie arrive en Phase 4.
  // Cette valeur viendra de sophie_configurations.is_active.
  const sophieActive = false;

  return (
    <div className="min-h-dvh">
      <AppHeader organizationName={activeOrganization.name} sophieActive={sophieActive} />
      <main className="mx-auto max-w-2xl px-4 pb-navbar pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
