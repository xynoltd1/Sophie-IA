import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { Carte, Tableau, TitreSection } from "@/components/admin/surface";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utilisateurs — Plateforme" };

/**
 * Les comptes de la plateforme.
 *
 * ## Ce qui est montré, et ce qui ne l'est pas
 *
 * Le nom, l'entreprise, le rôle, la date de création. Pas l'adresse e-mail
 * complète : exploiter la plateforme ne demande pas de lire le carnet
 * d'adresses de ses clients, et une liste d'e-mails professionnels est
 * exactement ce qu'on vole dans une base. L'adresse est tronquée, assez pour
 * reconnaître un compte, pas assez pour en faire une liste de diffusion.
 *
 * Les droits d'administration de la plateforme ne se donnent pas depuis cet
 * écran. Ils s'accordent en base, délibérément : un espace qui peut se
 * distribuer lui-même des droits est un espace dont une seule faille suffit.
 */
function adresseTronquee(email: string | null): string {
  if (!email) return "—";
  const [compte, domaine] = email.split("@");
  if (!compte || !domaine) return "—";
  const visible = compte.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(compte.length - 2, 1))}@${domaine}`;
}

export default async function UtilisateursPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const [profils, membres, organisations] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, is_platform_admin, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("organization_members")
      .select("user_id, organization_id, role, status"),
    admin.from("organizations").select("id, name").is("deleted_at", null),
  ]);

  const { data: comptes } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const emails = new Map<string, string | null>(
    (comptes?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );
  const derniereConnexion = new Map<string, string | null>(
    (comptes?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  const nomOrganisation = new Map<string, string>(
    ((organisations.data ?? []) as { id: string; name: string }[]).map((o) => [
      o.id,
      o.name,
    ]),
  );

  const appartenance = new Map<
    string,
    { nom: string; role: string; statut: string }
  >();
  for (const membre of (membres.data ?? []) as {
    user_id: string;
    organization_id: string;
    role: string;
    status: string;
  }[]) {
    appartenance.set(membre.user_id, {
      nom: nomOrganisation.get(membre.organization_id) ?? "—",
      role: membre.role,
      statut: membre.status,
    });
  }

  const lignes = (
    (profils.data ?? []) as {
      id: string;
      full_name: string | null;
      is_platform_admin: boolean;
      created_at: string;
    }[]
  ).map((profil) => ({
    ...profil,
    email: emails.get(profil.id) ?? null,
    connexion: derniereConnexion.get(profil.id) ?? null,
    organisation: appartenance.get(profil.id),
  }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Utilisateurs
      </h1>

      <TitreSection
        detail={`${lignes.length} comptes, du plus récent au plus ancien.`}
      >
        Comptes
      </TitreSection>

      {lignes.length === 0 ? (
        <EmptyState
          title="Aucun compte"
          description="Les inscriptions apparaîtront ici."
        />
      ) : (
        <Tableau
          entetes={[
            "Nom",
            "Adresse",
            "Entreprise",
            "Rôle",
            "Dernière connexion",
          ]}
        >
          {lignes.map((ligne) => (
            <tr key={ligne.id}>
              <td className="px-4 py-3">
                <span className="font-medium">
                  {ligne.full_name ?? "Sans nom"}
                </span>
                {ligne.is_platform_admin ? (
                  <Badge ton="signal" className="ml-2">
                    plateforme
                  </Badge>
                ) : null}
              </td>
              <td className="px-4 py-3 text-ink-soft">
                {adresseTronquee(ligne.email)}
              </td>
              <td className="px-4 py-3 text-ink-soft">
                {ligne.organisation?.nom ?? "—"}
              </td>
              <td className="px-4 py-3 text-ink-soft">
                {ligne.organisation?.role ?? "—"}
                {ligne.organisation?.statut &&
                ligne.organisation.statut !== "ACTIVE"
                  ? " · en attente"
                  : ""}
              </td>
              <td className="tabular px-4 py-3 text-ink-soft">
                {ligne.connexion
                  ? new Date(ligne.connexion).toLocaleDateString("fr-BE", {
                      timeZone: "Europe/Brussels",
                    })
                  : "jamais"}
              </td>
            </tr>
          ))}
        </Tableau>
      )}

      <Carte>
        <p className="font-medium">Pourquoi les adresses sont masquées</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Exploiter la plateforme ne demande pas de lire le carnet d’adresses de
          ses clients. Une liste d’e-mails professionnels complète est
          exactement ce qu’on cherche à voler dans une base de données ; ce qui
          est affiché suffit à reconnaître un compte sans constituer cette
          liste.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Les droits d’administration de la plateforme ne se donnent pas depuis
          cet écran, mais en base. Un espace capable de se distribuer ses
          propres droits n’a besoin que d’une faille.
        </p>
      </Carte>
    </div>
  );
}
