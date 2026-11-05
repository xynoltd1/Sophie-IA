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
import { SITE_URL } from "@/lib/seo/site";

export const dynamic = "force-dynamic";
export const metadata = { title: "SEO et acquisition — Plateforme" };

const TONS = {
  OK: "signal",
  ATTENTION: "attention",
  MANQUE: "urgent",
} as const;
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
  searchParams: Promise<{ periode?: string }>;
}) {
  await requirePlatformAdmin();
  const { periode: brut } = await searchParams;
  const periode = periodeDepuis(brut);

  const [points, { trafic, vide }, sources, pages, serie] = await Promise.all([
    Promise.resolve(auditSeo()),
    traficSite(periode.jours),
    sourcesSite(periode.jours),
    pagesSite(periode.jours),
    serieSite(periode.jours),
  ]);

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
        <TitreSection>Search Console</TitreSection>
        <Carte>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">Google Search Console</p>
            <Badge ton="attention">Connexion nécessaire</Badge>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Les positions dans Google, les impressions et les mots tapés par les
            visiteurs ne viennent que de Search Console. Aucune de ces données
            n’est accessible autrement, et aucune n’est affichée ici tant que la
            connexion n’existe pas.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            La marche à suivre — vérification de propriété, dépôt du plan du
            site, suivi de l’indexation — est détaillée dans{" "}
            <code>docs/SEO.md</code> et dans le plan d’action. Elle demande un
            accès à votre compte Google et au DNS du domaine : je ne peux pas la
            faire à votre place.
          </p>
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
