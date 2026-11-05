import Link from "next/link";
import { requireOrganization } from "@/lib/auth/session";
import { createServerSupabase } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui/sheet";
import { ErrorState } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import {
  EquipeEditor,
  type LigneInvitation,
  type LigneMembre,
} from "./equipe-editor";
import type { MemberRole } from "@/types/database";

export const dynamic = "force-dynamic";
export const metadata = { title: "Équipe — Sophie IA" };

export default async function EquipePage() {
  const { activeOrganization } = await requireOrganization();
  const supabase = await createServerSupabase();
  const orgId = activeOrganization.organization_id;

  const [membresRes, invitationsRes] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id, role, status, profiles(full_name)")
      .eq("organization_id", orgId)
      .order("role"),
    supabase
      .from("organization_invitations")
      .select("id, email, role, expires_at")
      .eq("organization_id", orgId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const membres: LigneMembre[] = (
    (membresRes.data ?? []) as unknown as {
      user_id: string;
      role: MemberRole;
      status: string;
      profiles: { full_name: string | null } | null;
    }[]
  ).map((row) => ({
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    nom: row.profiles?.full_name ?? null,
  }));

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/app/reglages"
        className="text-sm text-ink-soft underline underline-offset-4"
      >
        ← Réglages
      </Link>
      <SectionTitle>Équipe</SectionTitle>
      <p className="text-sm text-ink-soft">
        Un membre retiré garde son historique : ses appels et ses rendez-vous
        restent rattachés à lui. Il perd seulement l’accès.
      </p>

      {membresRes.error ? (
        <ErrorState description="Votre équipe n’a pas pu être chargée." />
      ) : (
        <EquipeEditor
          membres={membres}
          invitations={(invitationsRes.data ?? []) as LigneInvitation[]}
          peutGerer={can(activeOrganization.role, "members:invite")}
        />
      )}
    </div>
  );
}
