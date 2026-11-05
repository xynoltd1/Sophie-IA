import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { Carte, TitreSection } from "@/components/admin/surface";
import { Badge } from "@/components/ui/badge";
import { CATALOGUE, CATEGORIES, type Categorie } from "@/lib/config/catalogue";
import { etatSecrets, reglages } from "@/lib/config/platform";
import {
  LIBELLES_ETAT,
  TONS_ETAT,
  quand,
  santeIntegrations,
} from "@/lib/platform/health";
import { ProviderForm } from "./provider-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intégrations — Plateforme" };

/**
 * Configuration des fournisseurs.
 *
 * ## Ce que cet écran change
 *
 * Avant lui, chaque clé d'API vivait dans les variables d'environnement de
 * Vercel : changer de modèle d'IA demandait d'ouvrir Vercel, d'éditer une
 * variable et de redéployer. Ici, on saisit, on enregistre, et la nouvelle
 * valeur s'applique d'ici une minute — le temps que les caches des instances
 * expirent.
 *
 * ## Les fournisseurs sans adaptateur
 *
 * Ils apparaissent, marqués indisponibles, avec la raison. Les cacher
 * laisserait croire qu'ils n'existent pas ; leur donner un formulaire
 * laisserait croire qu'ils fonctionnent.
 */
export default async function IntegrationsPage() {
  await requirePlatformAdmin();

  const [secrets, sante] = await Promise.all([
    etatSecrets(),
    santeIntegrations(),
  ]);

  // Les réglages non secrets de chaque fournisseur, pour pré-remplir.
  const valeurs = new Map<string, Record<string, string>>();
  for (const config of CATALOGUE) {
    if (!config.implemente || config.champs.length === 0) continue;
    const lus = await reglages(config.cle, {});
    valeurs.set(
      config.cle,
      Object.fromEntries(
        Object.entries(lus).map(([k, v]) => [
          k,
          v === null || v === undefined ? "" : String(v),
        ]),
      ),
    );
  }

  const etatDe = (cle: string) => sante.find((s) => s.cle === cle);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Intégrations
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Les clés enregistrées ici sont chiffrées et ne sont jamais
          réaffichées. Elles l’emportent sur les variables de Vercel, qui
          restent comme secours.
        </p>
      </div>

      {CATEGORIES.map((categorie: Categorie) => {
        const fournisseurs = CATALOGUE.filter((f) => f.categorie === categorie);
        if (fournisseurs.length === 0) return null;

        return (
          <section key={categorie}>
            <TitreSection>{categorie}</TitreSection>

            <div className="flex flex-col gap-3">
              {fournisseurs.map((config) => {
                const etat = etatDe(config.cle);

                return (
                  <Carte key={config.cle}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{config.nom}</p>
                        <p className="mt-0.5 text-sm text-ink-soft">
                          {config.role}
                        </p>
                      </div>
                      {config.implemente && etat ? (
                        <Badge ton={TONS_ETAT[etat.etat]}>
                          {LIBELLES_ETAT[etat.etat]}
                        </Badge>
                      ) : (
                        <Badge ton="neutre">Indisponible</Badge>
                      )}
                    </div>

                    {config.indisponible ? (
                      <p className="mt-3 rounded-control bg-paper px-3 py-2.5 text-sm leading-relaxed text-ink-soft">
                        {config.indisponible}
                      </p>
                    ) : null}

                    {config.note ? (
                      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                        {config.note}
                      </p>
                    ) : null}

                    {etat ? (
                      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                        <div className="flex gap-2">
                          <dt className="text-ink-faint">
                            Dernier test réussi
                          </dt>
                          <dd className="tabular">
                            {quand(etat.dernierSucces)}
                          </dd>
                        </div>
                        <div className="flex gap-2">
                          <dt className="text-ink-faint">Dernier échec</dt>
                          <dd className="tabular">
                            {quand(etat.dernierEchec)}
                          </dd>
                        </div>
                      </dl>
                    ) : null}

                    {/* Un bloc de formulaire ne se dessine que s'il contient
                        quelque chose. Sans champ ni bouton de test, il ne
                        restait qu'un trait, et un trait laisse croire qu'un
                        élément a raté son chargement. */}
                    {config.implemente &&
                    (config.champs.length > 0 || config.testable) ? (
                      <div className="mt-4 border-t border-line pt-4">
                        <ProviderForm
                          config={config}
                          secrets={secrets.filter(
                            (s) => s.provider === config.cle,
                          )}
                          valeurs={valeurs.get(config.cle) ?? {}}
                        />
                      </div>
                    ) : null}

                    {config.documentation ? (
                      <p className="mt-3 text-sm">
                        <a
                          href={config.documentation}
                          target="_blank"
                          rel="noreferrer"
                          className="text-signal underline underline-offset-4"
                        >
                          Documentation officielle
                        </a>
                      </p>
                    ) : null}
                  </Carte>
                );
              })}
            </div>
          </section>
        );
      })}

      <Carte>
        <p className="font-medium">Ce qui ne se règle jamais ici</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">
          Trois clés restent dans les variables de Vercel, et aucun écran ne les
          proposera : celle qui lit toute la base, celle qui déchiffre cette
          page, et celle qui ouvre les travaux planifiés. La raison est
          mécanique, pas prudentielle — la clé qui déchiffre les secrets ne peut
          pas être rangée avec eux.
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          <Link href="/admin/sante" className="underline underline-offset-4">
            Voir la santé du système
          </Link>
        </p>
      </Carte>
    </div>
  );
}
