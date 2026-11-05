import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";
import { Carte, TitreSection } from "@/components/admin/surface";
import { FormulaireMotDePasse, FormulaireNom } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon compte — Plateforme" };

/**
 * Compte administrateur.
 *
 * Ce qui s'y règle et ce qui ne s'y règle pas obéit à une seule règle : un
 * espace ne doit pas pouvoir augmenter ses propres droits. Le nom et le mot de
 * passe se changent ici ; le droit d'administration de la plateforme, non. Il
 * s'accorde en base, par quelqu'un qui a déjà accès à la base.
 */
export default async function ParametresPage() {
  const { userId, email } = await requirePlatformAdmin();

  const supabase = await createServerSupabase();
  const { data: profil } = await supabase
    .from("profiles")
    .select("full_name, created_at")
    .eq("id", userId)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Mon compte
      </h1>

      <section>
        <TitreSection>Identité</TitreSection>
        <Carte>
          <dl className="mb-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-faint">Adresse e-mail</dt>
              <dd>{email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Rôle</dt>
              <dd>Administrateur de la plateforme</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Compte créé le</dt>
              <dd className="tabular">
                {profil?.created_at
                  ? new Date(profil.created_at as string).toLocaleDateString(
                      "fr-BE",
                      {
                        timeZone: "Europe/Brussels",
                      },
                    )
                  : "—"}
              </dd>
            </div>
          </dl>

          <FormulaireNom
            nom={(profil?.full_name as string | undefined) ?? ""}
          />
        </Carte>
      </section>

      <section>
        <TitreSection detail="L’ancien mot de passe est redemandé : une session restée ouverte dans un bureau ne doit pas suffire à changer les clés de la plateforme.">
          Mot de passe
        </TitreSection>
        <Carte>
          <FormulaireMotDePasse />
        </Carte>
      </section>

      <section>
        <TitreSection>Ce qui ne se règle pas ici</TitreSection>
        <Carte>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-soft">
            <li>
              <span className="font-medium text-ink">
                Le droit d’administration.
              </span>{" "}
              Il s’accorde en base, par quelqu’un qui y a déjà accès. Un espace
              capable de se distribuer ses propres droits n’a besoin que d’une
              faille.
            </li>
            <li>
              <span className="font-medium text-ink">L’adresse e-mail.</span> La
              changer demande de vérifier la nouvelle avant d’abandonner
              l’ancienne, sinon une faute de frappe ferme le compte
              définitivement. Ce parcours n’est pas écrit : il vaut mieux
              l’absence qu’une version qui enferme dehors.
            </li>
            <li>
              <span className="font-medium text-ink">
                Les sessions ouvertes.
              </span>{" "}
              Supabase ne permet pas de les lister depuis l’application. Se
              déconnecter ferme la session courante, pas les autres.
            </li>
          </ul>
        </Carte>
      </section>
    </div>
  );
}
