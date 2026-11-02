import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { signOut } from "@/app/(auth)/actions";
import { getCalendarState } from "@/lib/crm/calendar-state";
import { CalendarPanel } from "./calendar-panel";
import type { MemberRole, MemberStatus } from "@/types/database";

export const metadata = { title: "Plus — Sophie IA" };

const ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MEMBER: "Membre",
};

interface TeamRow {
  user_id: string;
  role: MemberRole;
  status: MemberStatus;
  job_title: string | null;
  profiles: { full_name: string | null } | null;
}

export default async function PlusPage({
  searchParams,
}: {
  searchParams: Promise<{ agenda?: string }>;
}) {
  const { activeOrganization } = await requireOrganization();
  const { agenda } = await searchParams;
  const calendarState = await getCalendarState(activeOrganization.organization_id);
  const supabase = await createServerSupabase();

  // Cette requete est filtree par RLS : elle ne peut renvoyer que les membres
  // de l’organisation active, meme si l’identifiant etait manipule.
  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id, role, status, job_title, profiles(full_name)")
    .eq("organization_id", activeOrganization.organization_id)
    .order("role", { ascending: true });

  const team = (data ?? []) as unknown as TeamRow[];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionTitle>Votre entreprise</SectionTitle>
        <Sheet className="flex flex-col gap-1">
          <p className="font-semibold">{activeOrganization.name}</p>
          <p className="text-sm text-ink-soft">
            Vous etes {ROLE_LABELS[activeOrganization.role].toLowerCase()}.
          </p>
        </Sheet>
      </section>

      <section>
        <SectionTitle>Agenda</SectionTitle>
        <CalendarPanel
          state={calendarState}
          canManage={can(activeOrganization.role, "organization:update")}
          notice={agenda}
        />
      </section>

      <section>
        <SectionTitle>Équipe</SectionTitle>
        {error ? (
          <ErrorState description="La liste de l’équipe n’a pas pu être chargée. Rechargez la page." />
        ) : (
          <Sheet className="divide-y divide-line p-0">
            {team.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {member.profiles?.full_name ?? "Membre sans nom"}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {ROLE_LABELS[member.role]}
                    {member.status !== "ACTIVE" ? " · en attente" : ""}
                  </p>
                </div>
              </div>
            ))}
          </Sheet>
        )}
        {can(activeOrganization.role, "members:invite") ? (
          <Link
            href="/app/reglages/equipe"
            className="mt-2 inline-block text-sm font-medium text-signal underline underline-offset-4"
          >
            Gérer l’équipe et les invitations
          </Link>
        ) : null}
      </section>

      <section>
        <SectionTitle>Réglages</SectionTitle>
        <ul className="flex flex-col gap-2">
          {[
            { href: "/app/reglages", titre: "Tous les réglages", detail: "Services, horaires, absences, intégrations." },
            { href: "/app/notifications", titre: "Alertes", detail: "Ce que Sophie a signalé." },
            { href: "/app/sophie", titre: "Sophie", detail: "Son état, ses connaissances, l’enregistrement." },
          ].map((entree) => (
            <li key={entree.href}>
              <Link href={entree.href} className="block">
                <Sheet interactive className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{entree.titre}</p>
                    <p className="text-sm text-ink-soft">{entree.detail}</p>
                  </div>
                  <span aria-hidden className="shrink-0 text-ink-soft">→</span>
                </Sheet>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <form action={signOut}>
        <Button type="submit" variant="secondary" size="lg">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
