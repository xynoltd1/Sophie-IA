import { requirePlatformAdmin } from "@/lib/auth/platform";
import {
  Carte,
  Chiffre,
  Tableau,
  TitreSection,
} from "@/components/admin/surface";
import { Courbe, Histogramme } from "@/components/admin/chart";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { PERIODES, periodeDepuis } from "@/lib/platform/stats";
import {
  auditSeo,
  pagesSite,
  serieSite,
  sourcesSite,
  traficSite,
} from "@/lib/seo/audit";
import { reglagesSite, SITE_URL } from "@/lib/seo/site";
import { pagesSeo } from "@/lib/seo/pages";
import {
  etatSearchConsole,
  performance,
  proprietes,
  searchConsoleConfigurable,
} from "@/lib/seo/search-console";
import {
  BoutonDeconnecterConsole,
  FormulaireImagePartage,
  FormulairePage,
  FormulaireProprieteConsole,
} from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO et acquisition — Plateforme" };

const TONS = {
  OK: "signal",
  ATTENTION: "attention",
  MANQUE: "urgent",
} as const;
/** Les retours de l'autorisation Google, dits en clair. */
const MESSAGES_CONSOLE: Record<string, string> = {
  connecte: "Search Console est connecté. Choisissez la propriété à suivre.",
  refuse:
    "Vous avez refusé l’autorisation sur l’écran Google. Rien n’a changé.",
  non_configure:
    "Les identifiants OAuth Google sont absents. Renseignez-les dans Intégrations.",
  reponse_incomplete:
    "Google a renvoyé une réponse incomplète. Relancez la connexion.",
  etat_invalide:
    "Le retour d’autorisation n’a pas pu être vérifié. Relancez la connexion depuis cet écran.",
  etat_expire:
    "L’autorisation a mis trop de temps. Relancez la connexion et validez dans les dix minutes.",
  session_differente:
    "La session a changé pendant l’autorisation. Reconnectez-vous puis relancez.",
  echec:
    "Google a refusé l’échange du jeton. Vérifiez que l’adresse de retour est déclarée dans Google Cloud.",
};

const MOTS = {
  OK: "en place",
  ATTENTION: "à vérifier",
  MANQUE: "manquant",
} as const;

/**
 * SEO et acquisition.
 *
 * ## Ce qui est mesuré, et ce qui ne peut pas l'être
 *
 * La fréquentation vient de notre propre collecte : elle est réelle, et elle
 * sous-estime. Les positions dans Google, le nombre d'impressions et les mots
 * tapés par les visiteurs ne viennent que de Search Console, qui n'est pas
 * connecté. Tant qu'il ne l'est pas, cet écran l'écrit au lieu d'afficher un
 * classement inventé — un faux classement orienterait de vraies décisions.
 */
export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; console?: string }>;
}) {
  await requirePlatformAdmin();
  const { periode: brut, console: retourConsole } = await searchParams;
  const periode = periodeDepuis(brut);

  const [
    points,
    { trafic, vide },
    sources,
    pages,
    serie,
    site,
    pagesReglees,
    etatConsole,
    consoleConfigurable,
  ] = await Promise.all([
    Promise.resolve(auditSeo()),
    traficSite(periode.jours),
    sourcesSite(periode.jours),
    pagesSite(periode.jours),
    serieSite(periode.jours),
    reglagesSite(),
    pagesSeo(),
    etatSearchConsole(),
    searchConsoleConfigurable(),
  ]);

  // Deux appels réseau seulement si la connexion existe : inutile de faire
  // attendre l'écran pour obtenir deux listes vides.
  const [listeProprietes, chiffres] = etatConsole.connecte
    ? await Promise.all([proprietes(), performance(periode.jours)])
    : [[], null];

  const total =
    trafic.sessions_humaines +
    trafic.sessions_incertaines +
    trafic.evenements_robots;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          SEO et acquisition
        </h1>
        <nav aria-label="Période" className="flex gap-2">
          {PERIODES.map((p) => (
            <Chip
              key={p.cle}
              href={`/admin/seo?periode=${p.cle}`}
              actif={p.cle === periode.cle}
            >
              {p.libelle}
            </Chip>
          ))}
        </nav>
      </div>

      <section>
        <TitreSection detail="Ce que le code met réellement en place, lu maintenant.">
          Configuration technique
        </TitreSection>
        <Tableau entetes={["Point", "État", "Détail"]}>
          {points.map((point) => (
            <tr key={point.titre}>
              <td className="px-4 py-3 font-medium">{point.titre}</td>
              <td className="px-4 py-3">
                <Badge ton={TONS[point.etat]}>{MOTS[point.etat]}</Badge>
              </td>
              <td className="px-4 py-3 text-ink-soft">{point.detail}</td>
            </tr>
          ))}
        </Tableau>
        <p className="mt-2 text-sm text-ink-faint">
          Vérifiable à la main :{" "}
          <a
            href={`${SITE_URL}/robots.txt`}
            className="underline underline-offset-4"
            rel="noreferrer"
          >
            robots.txt
          </a>{" "}
          et{" "}
          <a
            href={`${SITE_URL}/sitemap.xml`}
            className="underline underline-offset-4"
            rel="noreferrer"
          >
            sitemap.xml
          </a>
          .
        </p>
      </section>

      <section>
        <TitreSection detail="Mesure maison, sans cookie et sans traceur. Elle sous-estime toujours un peu : les bloqueurs refusent la requête, et c’est très bien ainsi.">
          Fréquentation du site public
        </TitreSection>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre
            libelle="Visites humaines probables"
            valeur={trafic.sessions_humaines}
            detail={`${trafic.pages_humaines} pages vues`}
          />
          <Chiffre
            libelle="Trafic incertain"
            valeur={trafic.sessions_incertaines}
            detail="ni classé humain, ni classé robot"
          />
          <Chiffre
            libelle="Robots identifiés"
            valeur={trafic.evenements_robots}
            detail="exclus des visites"
          />
          <Chiffre
            libelle="Clics sur un bouton"
            valeur={trafic.clics_action}
            detail={`${trafic.inscriptions} inscriptions`}
          />
        </div>

        {vide ? (
          <Carte className="mt-3">
            <p className="text-sm leading-relaxed text-ink-soft">
              Aucune visite mesurée. C’est le résultat attendu tant que le site
              public n’a pas été mis en ligne et visité : la collecte ne compte
              que la production, et jamais les pages privées.
            </p>
          </Carte>
        ) : (
          <>
            <Carte className="mt-3">
              <p className="mb-2 text-sm font-medium">
                Visites humaines par jour
              </p>
              <Courbe
                titre="Visites humaines par jour"
                points={serie.map((j) => ({
                  label: j.jour,
                  valeur: j.sessions,
                }))}
              />
            </Carte>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <Carte>
                <p className="mb-3 text-sm font-medium">
                  D’où viennent les visites
                </p>
                <Histogramme
                  titre="Sources"
                  points={sources.map((s) => ({
                    label: s.source,
                    valeur: s.sessions,
                  }))}
                />
              </Carte>
              <Carte>
                <p className="mb-3 text-sm font-medium">Pages les plus vues</p>
                <Histogramme
                  titre="Pages"
                  points={pages.map((p) => ({
                    label: p.chemin,
                    valeur: p.vues,
                  }))}
                />
              </Carte>
            </div>
          </>
        )}

        {total > 0 ? (
          <p className="mt-2 text-sm text-ink-faint">
            {Math.round((trafic.evenements_robots / total) * 100)} % des
            événements reçus ont été écartés comme automatisés.
          </p>
        ) : null}
      </section>

      <section>
        <TitreSection detail="Les positions, les impressions et les mots tapés par les visiteurs. Ces chiffres n’existent que là.">
          Search Console
        </TitreSection>

        {MESSAGES_CONSOLE[retourConsole ?? ""] ? (
          <p
            className={`mb-3 rounded-control px-3 py-2.5 text-sm leading-relaxed ${
              retourConsole === "connecte" ? "bg-signal-soft" : "bg-urgent-soft"
            }`}
          >
            {MESSAGES_CONSOLE[retourConsole ?? ""]}
          </p>
        ) : null}

        <Carte>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">Google Search Console</p>
            {etatConsole.connecte ? (
              <Badge ton="signal">connecté</Badge>
            ) : consoleConfigurable ? (
              <Badge ton="attention">connexion nécessaire</Badge>
            ) : (
              <Badge ton="urgent">identifiants Google absents</Badge>
            )}
          </div>

          {!consoleConfigurable ? (
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              La connexion utilise les mêmes identifiants OAuth que l’agenda.
              Renseignez-les d’abord dans Intégrations → Google Calendar.
            </p>
          ) : !etatConsole.connecte ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                L’autorisation demandée est en lecture seule sur les propriétés
                Search Console. Rien sur l’agenda, rien sur la messagerie.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                La vérification de propriété du domaine se fait une fois chez
                Google, à la main : elle demande un accès au DNS et ne peut pas
                être faite d’ici.
              </p>
              <div className="mt-4">
                <a
                  href="/api/integrations/search-console/start"
                  className="inline-flex min-h-12 items-center rounded-control bg-signal px-4 text-[0.9375rem] font-medium text-white hover:bg-signal-deep"
                >
                  Connecter Search Console
                </a>
              </div>
            </>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-ink-soft">Propriété suivie</dt>
                  <dd className="font-medium">
                    {etatConsole.propriete ?? "aucune encore choisie"}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-soft">Connecté le</dt>
                  <dd className="font-medium">
                    {etatConsole.connecteLe
                      ? new Date(etatConsole.connecteLe).toLocaleDateString(
                          "fr-FR",
                        )
                      : "—"}
                  </dd>
                </div>
              </dl>

              {etatConsole.derniereErreur ? (
                <p className="rounded-control bg-urgent-soft px-3 py-2.5 text-sm leading-relaxed">
                  Dernière erreur Google : {etatConsole.derniereErreur}
                </p>
              ) : null}

              <FormulaireProprieteConsole
                proprietes={listeProprietes}
                actuelle={etatConsole.propriete}
              />

              <div className="flex justify-end border-t border-line pt-3">
                <BoutonDeconnecterConsole />
              </div>
            </div>
          )}
        </Carte>

        {chiffres ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Chiffre
                libelle="Clics depuis Google"
                valeur={chiffres.clics}
                detail={`${chiffres.ctr} % des impressions`}
              />
              <Chiffre
                libelle="Impressions"
                valeur={chiffres.impressions}
                detail="apparitions dans les résultats"
              />
              <Chiffre
                libelle="Position moyenne"
                valeur={chiffres.position || "—"}
                detail="1 est le premier résultat"
              />
              <Chiffre
                libelle="Requêtes distinctes"
                valeur={chiffres.requetes.length}
                detail="les 10 premières ci-dessous"
              />
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">
                  Ce que les gens tapent
                </p>
                <Tableau entetes={["Requête", "Clics", "Position"]}>
                  {chiffres.requetes.map((ligne) => (
                    <tr key={ligne.valeur}>
                      <td className="px-4 py-2.5">{ligne.valeur}</td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {ligne.clics}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-soft">
                        {ligne.position}
                      </td>
                    </tr>
                  ))}
                </Tableau>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">
                  Les pages qui ressortent
                </p>
                <Tableau entetes={["Page", "Clics", "Position"]}>
                  {chiffres.pages.map((ligne) => (
                    <tr key={ligne.valeur}>
                      <td className="px-4 py-2.5 font-mono text-sm">
                        {ligne.valeur.replace(SITE_URL, "") || "/"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {ligne.clics}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-soft">
                        {ligne.position}
                      </td>
                    </tr>
                  ))}
                </Tableau>
              </div>
            </div>

            <p className="mt-2 text-sm text-ink-faint">
              Google ne publie rien avant deux à trois jours. La fenêtre
              s’arrête donc trois jours avant aujourd’hui : un zéro sur la
              période la plus courte est normal, pas une panne.
            </p>
          </>
        ) : etatConsole.connecte && etatConsole.propriete ? (
          <Carte className="mt-3">
            <p className="text-sm leading-relaxed text-ink-soft">
              Google n’a renvoyé aucun chiffre pour cette période. C’est le cas
              attendu tant que le site n’apparaît pas encore dans les résultats
              : l’indexation prend de quelques jours à quelques semaines après
              la première visite de Googlebot.
            </p>
          </Carte>
        ) : null}
      </section>

      <section>
        <TitreSection detail="Un titre et une description par page. Laissés vides, les champs reprennent les valeurs du site.">
          Référencement page par page
        </TitreSection>
        <div className="flex flex-col gap-3">
          {pagesReglees.map((page) => (
            <Carte key={page.path}>
              <FormulairePage page={page} />
            </Carte>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-faint">
          Seules les pages que le code rend réellement apparaissent ici. Ajouter
          une page au site se fait dans le code ; son référencement se règle
          ensuite ici.
        </p>
      </section>

      <section>
        <TitreSection detail="L’aperçu affiché quand un lien vers le site est partagé.">
          Image de partage
        </TitreSection>
        <Carte>
          <FormulaireImagePartage
            actuelle={site.og_image}
            chemins={pagesReglees.map((page) => page.path)}
          />
        </Carte>
      </section>

      <Carte>
        <p className="font-medium">Les limites de la mesure</p>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>
            Aucune détection de robots n’est sûre. Un robot bien écrit ressemble
            exactement à un navigateur, et rien côté serveur ne les distingue de
            façon fiable.
          </li>
          <li>
            Le visiteur unique sur plusieurs jours n’est pas mesuré :
            l’empreinte de session change chaque jour, pour éviter un traceur.
            Quelqu’un qui revient trois jours de suite compte trois fois.
          </li>
          <li>
            Les bloqueurs de publicité refusent la requête de mesure. Les
            chiffres sont donc un plancher, jamais un total.
          </li>
          <li>
            Les robots exclus du comptage ne sont pas bloqués. Googlebot doit
            parcourir le site : c’est tout l’objet du référencement.
          </li>
        </ul>
      </Carte>
    </div>
  );
}
