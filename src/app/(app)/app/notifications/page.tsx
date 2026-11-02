import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ListeNotifications } from "./liste";

export const dynamic = "force-dynamic";
export const metadata = { title: "Alertes — Sophie IA" };

export interface LigneNotification {
  id: string;
  category: "CRITIQUE" | "ACTION" | "INFO";
  title: string;
  body: string | null;
  href: string | null;
  created_at: string;
  read_at: string | null;
}

/**
 * Les alertes du professionnel (section 34).
 *
 * Les non lues d'abord, et c'est tout l'écran : une liste mélangée obligerait
 * à chercher ce qui reste à faire parmi ce qui est déjà traité.
 */
export default async function NotificationsPage() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();

  const { data, error } = await supabase
    .from("notifications")
    .select("id, category, title, body, href, created_at, read_at")
    .eq("organization_id", activeOrganization.organization_id)
    .order("created_at", { ascending: false })
    .limit(60);

  const toutes = (data ?? []) as LigneNotification[];
  const nonLues = toutes.filter((n) => n.read_at === null);
  const lues = toutes.filter((n) => n.read_at !== null);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle>Alertes</SectionTitle>

      {error ? (
        <ErrorState description="Vos alertes n’ont pas pu être chargées." />
      ) : toutes.length === 0 ? (
        <EmptyState
          title="Aucune alerte"
          description="Les urgences, les rendez-vous à valider et les nouveaux prospects apparaîtront ici."
          action={
            <Link href="/app" className="font-medium text-signal underline underline-offset-4">
              Retour à l’accueil
            </Link>
          }
        />
      ) : (
        <ListeNotifications nonLues={nonLues} lues={lues} />
      )}

      <Sheet tone="neutral">
        <p className="text-sm text-ink-soft">
          Une alerte mène toujours à la fiche concernée. Celles que vous avez lues restent
          consultables pendant un temps, puis disparaissent.
        </p>
      </Sheet>
    </div>
  );
}
