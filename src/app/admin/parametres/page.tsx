import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { Carte, TitreSection } from "@/components/admin/surface";
import { reglages } from "@/lib/config/platform";
import { reglagesSite, siteIndexable } from "@/lib/seo/site";
import { FormulaireAnalytics, FormulaireSite } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paramètres — Plateforme" };

/**
 * Paramètres de la plateforme.
 *
 * Ce qui se règle ici arrive réellement dans le rendu des pages publiques :
 * titre, description, canonique, image de partage, et les mêmes valeurs dans
 * `robots.txt` et le plan du site. Un formulaire dont la valeur n'atteindrait
 * pas le site serait une interface décorative.
 *
 * Ce qui ne se règle pas ici, et pourquoi, est écrit en bas de page. La règle
 * est simple : un interrupteur ne doit pas pouvoir créer une situation qu'on
 * ne saurait pas défaire — faire indexer une préversion, par exemple.
 */
export default async function ParametresPage() {
  await requirePlatformAdmin();

  const [site, mesure] = await Promise.all([
    reglagesSite(),
    reglages("analytics", { enabled: true, exclude_internal: true }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Paramètres
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Ces valeurs sont utilisées par les pages publiques, le plan du site et
          le fichier robots. Elles s’appliquent d’ici une minute, sans
          redéploiement.
        </p>
      </div>

      <section>
        <TitreSection detail="Ce que voient Google et les gens qui partagent un lien.">
          Site public
        </TitreSection>
        <Carte>
          <FormulaireSite site={site} />
        </Carte>
      </section>

      <section>
        <TitreSection detail="La collecte maison, sans cookie. Voir SEO et acquisition pour les chiffres.">
          Mesure de fréquentation
        </TitreSection>
        <Carte>
          <FormulaireAnalytics
            active={mesure.enabled !== false}
            exclureInterne={mesure.exclude_internal !== false}
          />
        </Carte>
      </section>

      <section>
        <TitreSection>Indexation</TitreSection>
        <Carte>
          <p className="text-sm">
            {siteIndexable()
              ? "Le site est indexable : NEXT_PUBLIC_APP_ENV vaut production."
              : "Le site n’est pas indexable : NEXT_PUBLIC_APP_ENV ne vaut pas production. robots.txt interdit tout et chaque page est en noindex."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Ce réglage n’a volontairement pas de bouton. Une préversion indexée
            fait concurrence au vrai site sur ses propres mots, et c’est Google
            qui choisit laquelle montrer — une erreur longue à rattraper, pour
            un gain nul. Il suit donc l’environnement, et rien d’autre.
          </p>
        </Carte>
      </section>

      <section>
        <TitreSection>Ce qui se règle ailleurs</TitreSection>
        <Carte>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-ink-soft">
            <li>
              <span className="font-medium text-ink">
                Les clés des fournisseurs
              </span>{" "}
              — dans{" "}
              <Link
                href="/admin/integrations"
                className="underline underline-offset-4"
              >
                Intégrations
              </Link>
              , chiffrées, jamais réaffichées.
            </li>
            <li>
              <span className="font-medium text-ink">Le domaine</span> — sur
              Vercel et chez votre registrar. Le changer ici ne déplace rien :
              ça déclare une adresse, et Google suit la déclaration même si le
              site n’y répond pas.
            </li>
            <li>
              <span className="font-medium text-ink">Les pages juridiques</span>{" "}
              — elles n’existent pas encore. Elles attendent les textes du
              juriste (plan d’action, étape C2), pas du développement.
            </li>
            <li>
              <span className="font-medium text-ink">
                Le logo et le favicon
              </span>{" "}
              — des fichiers dans le dépôt. Les rendre réglables demanderait un
              stockage d’images et une validation de format ; dites-le-moi si
              vous en avez besoin.
            </li>
          </ul>
        </Carte>
      </section>
    </div>
  );
}
