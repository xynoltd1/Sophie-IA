import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { signOut } from "@/app/(auth)/actions";
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

export default async function PlusPage() {
  const { activeOrganization } = await requireOrganization();
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
        <SectionTitle>Equipe</SectionTitle>
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
          <p className="mt-2 text-sm text-ink-soft">
            L’invitation de collaborateurs sera disponible en Phase 1.
          </p>
        ) : null}
      </section>

      <form action={signOut}>
        <Button type="submit" variant="secondary" size="lg">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
