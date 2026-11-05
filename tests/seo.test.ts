import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { classifier, cheminPublic } from "../src/lib/analytics/bots";
import { ESPACES_PRIVES, PAGES_PUBLIQUES, SITE_URL } from "../src/lib/seo/site";

const RACINE = process.cwd();

function lire(chemin: string): string {
  return readFileSync(resolve(RACINE, chemin), "utf-8");
}

describe("indexation", () => {
  it("le plan du site ne contient que des pages publiques", () => {
    // Le plan du site est le premier endroit ou un moteur va chercher ce qu il
    // ne connait pas. Une page privee annoncee la est une page privee
    // decouverte.
    // Les types litteraux rendent la comparaison impossible a l ecriture
    // d aujourd hui ; on elargit volontairement, car ce test garde contre la
    // ligne qu on ajoutera dans six mois.
    const publiques: string[] = PAGES_PUBLIQUES.map((p) => p.chemin);
    const prives: string[] = [...ESPACES_PRIVES];

    for (const chemin of publiques) {
      for (const prive of prives) {
        expect(
          chemin === prive || chemin.startsWith(`${prive}/`),
          `${chemin} est dans un espace prive`,
        ).toBe(false);
      }
    }
  });

  it("l adresse canonique est en HTTPS et sans barre finale", () => {
    // Deux adresses pour une meme page — avec et sans barre — se concurrencent
    // dans l index, et Google choisit lui-meme laquelle garder.
    expect(SITE_URL.startsWith("https://")).toBe(true);
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  it("robots.txt et le plan du site se taisent hors production", () => {
    const robots = lire("src/app/robots.ts");
    const sitemap = lire("src/app/sitemap.ts");
    // Une preversion indexee fait concurrence au vrai site sur ses propres mots.
    expect(robots).toContain("siteIndexable()");
    expect(sitemap).toContain("siteIndexable()");
  });

  it("les espaces prives portent un noindex, pas seulement une regle robots", () => {
    // robots.txt est une demande polie qu un moteur peut ignorer, et il ne
    // protege rien : il publie meme la liste des chemins caches.
    for (const chemin of [
      "src/app/(app)/layout.tsx",
      "src/app/admin/layout.tsx",
    ]) {
      expect(lire(chemin), `${chemin} n est pas en noindex`).toContain(
        "index: false",
      );
    }
  });

  it("la racine declare une adresse de base", () => {
    // Sans elle, chaque adresse de partage devrait etre ecrite en entier dans
    // chaque page, et une seule oubliee suffit a faire indexer la mauvaise.
    expect(lire("src/app/layout.tsx")).toContain("metadataBase");
  });

  it("les donnees structurees ne declarent ni prix ni note", () => {
    // Declarer un tarif qui n existe pas ou une note que personne n a donnee
    // est une donnee structuree trompeuse.
    const accueil = lire("src/app/page.tsx");
    const bloc = accueil.slice(accueil.indexOf("donneesStructurees"));
    expect(bloc).toContain("SoftwareApplication");
    expect(bloc).not.toContain("aggregateRating");
    expect(bloc).not.toContain('"offers"');
  });

  it("la page d accueil n est pas dans un groupe de routes", () => {
    // Next.js n emet pas le manifeste des composants clients pour une page
    // d accueil placee dans un groupe de routes. La compilation passe en
    // local et le deploiement echoue sur :
    //   ENOENT ... app/(public)/page_client-reference-manifest.js
    // Le symptome n apparait donc qu au dernier moment, la ou il coute le
    // plus cher. Vu le 2026-11-05 sur Vercel.
    expect(existsSync(resolve(RACINE, "src/app/page.tsx"))).toBe(true);

    for (const entree of readdirSync(resolve(RACINE, "src/app"), {
      withFileTypes: true,
    })) {
      if (!entree.isDirectory() || !entree.name.startsWith("(")) continue;
      expect(
        existsSync(resolve(RACINE, "src/app", entree.name, "page.tsx")),
        `${entree.name} contient une page d accueil : elle cassera le deploiement`,
      ).toBe(false);
    }
  });

  it("il existe au moins une page publique indexable", () => {
    // Le site a longtemps redirige sa racine vers la connexion : tout travail
    // de referencement portait alors sur rien.
    expect(existsSync(resolve(RACINE, "src/app/page.tsx"))).toBe(true);
    expect(PAGES_PUBLIQUES.length).toBeGreaterThan(0);
  });
});

describe("exclusion des robots", () => {
  it("reconnait les robots declares", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
      "GPTBot/1.0",
      "curl/8.4.0",
    ]) {
      expect(classifier({ userAgent: ua }).classification, ua).toBe("BOT");
    }
  });

  it("compte un vrai navigateur comme humain", () => {
    const verdict = classifier({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
      webdriver: false,
      visible: true,
      largeurEcran: 390,
    });
    expect(verdict.classification).toBe("HUMAN");
  });

  it("refuse de trancher quand il ne sait pas", () => {
    // Trois reponses et non deux : « humain » et « robot » sont des jugements,
    // « incertain » est le refus d en porter un.
    expect(classifier({ userAgent: null }).classification).toBe("UNKNOWN");
    expect(
      classifier({ userAgent: "quelque chose d inhabituel" }).classification,
    ).toBe("UNKNOWN");
  });

  it("donne toujours une raison", () => {
    // Sans la raison, la methode n est ni verifiable ni corrigible.
    for (const ua of [null, "Googlebot", "Mozilla/5.0 Safari/605"]) {
      expect(classifier({ userAgent: ua }).reason.length).toBeGreaterThan(5);
    }
  });

  it("ne mesure jamais les espaces prives", () => {
    expect(cheminPublic("/")).toBe(true);
    expect(cheminPublic("/signup")).toBe(true);
    expect(cheminPublic("/app")).toBe(false);
    expect(cheminPublic("/app/appels/123")).toBe(false);
    expect(cheminPublic("/admin/seo")).toBe(false);
    expect(cheminPublic("/api/analytics")).toBe(false);
    expect(cheminPublic("https://ailleurs.example/")).toBe(false);
  });
});

describe("collecte", () => {
  const route = lire("src/app/api/analytics/route.ts");

  it("n ecrit ni adresse IP ni agent utilisateur", () => {
    // Les deux servent a classer et a regrouper, et ne doivent pas survivre a
    // la requete. Les stocker ferait de la mesure un fichier de donnees
    // personnelles.
    const insertion = route.slice(route.indexOf('from("site_events").insert'));
    expect(insertion).not.toContain("user_agent");
    expect(insertion).not.toContain("ip:");
  });

  it("repond toujours la meme chose", () => {
    // Un collecteur qui repond « deja vu » ou « refuse » apprend a qui
    // l interroge comment contourner le filtrage.
    expect(route).toContain("status: 204");
  });

  it("l empreinte de session change chaque jour", () => {
    const session = lire("src/lib/analytics/session.ts");
    expect(session).toContain("toISOString().slice(0, 10)");
    expect(session).toContain("createHash");
  });

  it("ne garde que le domaine du referent", () => {
    // Une adresse de provenance peut contenir une requete de recherche, donc
    // des donnees personnelles.
    const session = lire("src/lib/analytics/session.ts");
    const bloc = session.slice(
      session.indexOf("export function domaineProvenance"),
    );
    expect(bloc).toContain("hostname");
  });
});

describe("console d administration", () => {
  it("chaque page verifie les droits plateforme", () => {
    // La mise en page les verifie deja ; une page atteinte autrement ne serait
    // pas protegee par elle.
    const base = resolve(RACINE, "src/app/admin");
    const pages: string[] = [];
    const parcourir = (dossier: string) => {
      for (const entree of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = `${dossier}/${entree.name}`;
        if (entree.isDirectory()) parcourir(chemin);
        else if (entree.name === "page.tsx" || entree.name === "route.ts")
          pages.push(chemin);
      }
    };
    parcourir(base);

    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages) {
      expect(
        readFileSync(page, "utf-8"),
        `${page.replace(RACINE, "")} ne verifie pas les droits`,
      ).toContain("requirePlatformAdmin");
    }
  });

  it("la deconnexion passe par une action serveur", () => {
    // Vider l etat du navigateur laisserait la session Supabase valide : la
    // personne se croirait deconnectee sans l etre.
    const menu = lire("src/components/admin/account-menu.tsx");
    expect(menu).toContain("signOut");
    expect(menu).toContain("<form action={signOut}>");
  });

  it("la sante ne confond plus le passe et le present", () => {
    // L ecran affichait « Teste en conditions reelles » a cote de « Variables
    // manquantes » : deux affirmations exactes et contradictoires.
    const sante = lire("src/lib/platform/health.ts");
    expect(sante).toContain("NON_CONFIGURE");
    const bloc = sante.slice(sante.indexOf("if (manquantes.length > 0)"));
    expect(bloc.slice(0, 200)).toContain('etat = "NON_CONFIGURE"');
  });

  it("aucun chiffre d argent n est invente", () => {
    // Une marge fausse oriente une decision de prix : c est le pire endroit ou
    // mettre un chiffre estime.
    for (const page of [
      "src/app/admin/page.tsx",
      "src/app/admin/statistiques/page.tsx",
    ]) {
      const contenu = lire(page);
      const bloc = contenu.slice(contenu.indexOf("Marge brute"));
      expect(bloc.slice(0, 300), page).toContain("indisponible");
    }
  });
});

describe("configuration depuis la console", () => {
  const platform = lire("src/lib/config/platform.ts");

  it("la base l emporte sur l environnement", () => {
    // L inverse donnerait une interface dont les reglages seraient
    // silencieusement ignores : un formulaire decoratif.
    const bloc = platform.slice(
      platform.indexOf("export async function secret"),
    );
    expect(bloc.indexOf("provider_credentials")).toBeLessThan(
      bloc.indexOf("process.env[variableEnv]"),
    );
  });

  it("les secrets sont chiffres avant d entrer en base", () => {
    const bloc = platform.slice(
      platform.indexOf("export async function enregistrerSecret"),
    );
    expect(bloc).toContain("encryptSecret(propre)");
    // Jamais la valeur en clair dans la colonne.
    expect(bloc).not.toContain("secret: propre");
  });

  it("la table des secrets n est lisible par personne", () => {
    // Pas de policy de lecture, pas de GRANT : une table sans policy est
    // invisible, et c est exactement ce qu on veut d une table de secrets.
    const sql = lire(
      "supabase/migrations/20261105100000_0034_platform_configuration.sql",
    );
    const bloc = sql.slice(
      sql.indexOf("create table if not exists public.provider_credentials"),
    );
    const avantSuivante = bloc.slice(
      0,
      bloc.indexOf("search_console_connection"),
    );
    expect(avantSuivante).toContain(
      "revoke all on public.provider_credentials",
    );
    expect(avantSuivante).not.toContain("for select to authenticated");
  });

  it("l empreinte est salee", () => {
    // Une empreinte nue d une cle courte se retrouve par force brute.
    const bloc = platform.slice(platform.indexOf("export function empreinte"));
    expect(bloc).toContain("SECRETS_ENCRYPTION_KEY");
  });

  it("aucune valeur de secret ne sort de la base", () => {
    // `etatSecrets` alimente l ecran : il ne doit jamais selectionner la
    // colonne chiffree.
    const bloc = platform.slice(
      platform.indexOf("export async function etatSecrets"),
    );
    expect(bloc).toContain("provider, field, fingerprint, last4, updated_at");
    expect(bloc).not.toContain('select("secret")');
  });

  it("les cles de demarrage ne sont pas dans le catalogue", () => {
    // La cle qui dechiffre les secrets ne peut pas etre rangee avec eux, et
    // celle qui lit la base ne peut pas etre lue depuis la base.
    const catalogue = lire("src/lib/config/catalogue.ts");
    for (const interdite of [
      "SUPABASE_SERVICE_ROLE_KEY",
      "SECRETS_ENCRYPTION_KEY",
      "CRON_SECRET",
      "VOICE_WEBHOOK_SECRET",
    ]) {
      const champs = catalogue.split("champs:").slice(1).join("");
      expect(champs, `${interdite} est proposee a la saisie`).not.toContain(
        `variableEnv: "${interdite}"`,
      );
    }
  });

  it("les reglages du site atteignent vraiment le rendu", () => {
    // Un formulaire qui ecrirait en base sans que le `<head>` change serait
    // une interface decorative.
    const accueil = lire("src/app/page.tsx");
    expect(accueil).toContain("export async function generateMetadata");
    expect(accueil).toContain("reglagesSite()");
    expect(lire("src/app/robots.ts")).toContain("reglagesSite()");
    expect(lire("src/app/sitemap.ts")).toContain("reglagesSite()");
  });

  it("l indexation ne se regle pas depuis un formulaire", () => {
    // Un interrupteur qui ferait indexer une preversion mettrait deux sites
    // en concurrence sur les memes mots.
    const parametres = lire("src/app/admin/parametres/actions.ts");
    expect(parametres).not.toContain("siteIndexable");
    expect(parametres).not.toContain("NEXT_PUBLIC_APP_ENV =");
  });

  it("les tests de connexion sont des lectures", () => {
    // Aucun n envoie de SMS ni ne passe d appel : un test ne doit pas couter
    // d argent ni deranger quelqu un.
    const tests = lire("src/lib/config/tests.ts");
    expect(tests).not.toContain("Messages.json");
    expect(tests).toContain("Aucun SMS n’a été envoyé");
    expect(tests).toContain("record_integration_check");
  });

  it("le test d IA n utilise jamais une vraie transcription", () => {
    const tests = lire("src/lib/config/tests.ts");
    const bloc = tests.slice(tests.indexOf("async function testerAI"));
    expect(bloc).toContain("Jean Test");
    expect(bloc).not.toContain("call_transcript_segments");
  });
});

describe("Search Console", () => {
  it("la connexion est reelle : aucune donnee inventee", () => {
    // Un ecran qui afficherait des positions sans connexion orienterait de
    // vraies decisions avec des chiffres faux.
    const client = lire("src/lib/seo/search-console.ts");
    expect(client).toContain("searchconsole.googleapis.com");
    expect(client).toContain("searchAnalytics/query");
    // Aucune valeur de repli : sans connexion la fonction rend null.
    expect(client).toContain("if (!etat.connecte || !etat.propriete) return null");
    expect(client).not.toMatch(/clics:\s*\d+[^?]/);
  });

  it("la portee demandee est en lecture seule", () => {
    // Demander l ecriture rallongerait la verification Google et donnerait un
    // acces dont on ne se sert pas.
    const client = lire("src/lib/seo/search-console.ts");
    expect(client).toContain("webmasters.readonly");
    expect(client).not.toContain("auth/webmasters\"");
  });

  it("le jeton de rafraichissement est chiffre et ne sort jamais", () => {
    const client = lire("src/lib/seo/search-console.ts");
    expect(client).toContain("encryptSecret(corps.refresh_token)");
    // L etat expose a l ecran ne contient pas le jeton.
    const etat = client.slice(client.indexOf("export async function etatSearchConsole"));
    expect(etat).not.toContain("refresh_token");
  });

  it("l autorisation demande un jeton durable, explicitement", () => {
    // Sans access_type=offline la connexion meurt au bout d une heure ; sans
    // prompt=consent une reconnexion ne redonne pas de jeton durable.
    const client = lire("src/lib/seo/search-console.ts");
    expect(client).toContain('access_type: "offline"');
    expect(client).toContain('prompt: "consent"');
  });

  it("le retour d autorisation est verifie et borne dans le temps", () => {
    const callback = lire("src/app/api/integrations/search-console/callback/route.ts");
    expect(callback).toContain("verifyPayload(state)");
    expect(callback).toContain("ETAT_DUREE_MS");
    // La signature ne prouve pas l identite de celui qui revient.
    expect(callback).toContain("requirePlatformAdmin()");
    expect(callback).toContain("userId !== donnees.user");
  });

  it("seul un administrateur de plateforme peut connecter", () => {
    for (const route of [
      "src/app/api/integrations/search-console/start/route.ts",
      "src/app/api/integrations/search-console/callback/route.ts",
    ]) {
      expect(lire(route)).toContain("requirePlatformAdmin");
    }
  });

  it("la fenetre de donnees tient compte du retard de Google", () => {
    // Demander hier renvoie presque toujours zero : Google ne publie rien
    // avant deux a trois jours.
    const client = lire("src/lib/seo/search-console.ts");
    expect(client).toContain("3 * 86_400_000");
  });
});

describe("referencement page par page", () => {
  it("un chemin de page ne peut pas etre invente", () => {
    const actions = lire("src/app/admin/seo/actions.ts");
    expect(actions).toContain("cheminAutorise(page.path)");
    // Et la table refuse elle aussi, independamment du formulaire.
    const migration = lire(
      "supabase/migrations/20261105140000_0035_seo_pages.sql",
    );
    expect(migration).toContain("seo_pages_chemin_public");
    for (const espace of ESPACES_PRIVES) {
      expect(migration).toContain(`path not like '${espace}%'`);
    }
  });

  it("le plan du site exige les quatre conditions", () => {
    const pages = lire("src/lib/seo/pages.ts");
    const bloc = pages.slice(pages.indexOf("pagesPourPlanDuSite"));
    expect(bloc).toContain("cheminAutorise(page.path)");
    expect(bloc).toContain("page.published");
    expect(bloc).toContain("page.in_sitemap");
    expect(bloc).toContain("page.indexable");
  });

  it("le reglage d une page atteint reellement la page", () => {
    // Un formulaire dont la valeur n arriverait pas dans le rendu serait une
    // interface decorative.
    expect(lire("src/app/page.tsx")).toContain('pageSeo("/")');
    expect(lire("src/app/sitemap.ts")).toContain("pagesPourPlanDuSite()");
    expect(lire("src/app/admin/seo/actions.ts")).toContain(
      'revalidatePath("/sitemap.xml")',
    );
  });

  it("une page non indexable le reste meme si le site l est", () => {
    const accueil = lire("src/app/page.tsx");
    expect(accueil).toContain("siteIndexable() && page?.indexable !== false");
  });
});

describe("image de partage", () => {
  it("le chemin du fichier n est pas choisi par le navigateur", () => {
    // Un nom venant du client est une adresse qu il controle : il pourrait
    // ecrire ailleurs dans le bucket.
    const actions = lire("src/app/admin/seo/actions.ts");
    expect(actions).toContain("const chemin = `partage/og-${Date.now()}");
    expect(actions).not.toContain("fichier.name");
  });

  it("le format et la taille sont verifies cote serveur", () => {
    const actions = lire("src/app/admin/seo/actions.ts");
    expect(actions).toContain("TYPES_IMAGE.includes(fichier.type)");
    expect(actions).toContain("fichier.size > TAILLE_MAX");
    // Et le bucket refuse aussi, independamment du formulaire.
    const migration = lire(
      "supabase/migrations/20261105140000_0035_seo_pages.sql",
    );
    expect(migration).toContain("2 * 1024 * 1024");
    expect(migration).toContain("image/png");
  });

  it("chaque envoi porte un nom neuf", () => {
    // Les caches des reseaux sociaux gardent longtemps une meme adresse.
    expect(lire("src/app/admin/seo/actions.ts")).toContain("Date.now()");
  });
});

describe("les reglages atteignent le site", () => {
  it("les pages qui lisent la base ne sont pas figees au build", () => {
    // Sans duree de revalidation, Next prerendrait ces pages une fois pour
    // toutes : le formulaire d administration ecrirait en base sans que rien
    // ne change sur le site, jusqu au redeploiement suivant.
    for (const chemin of [
      "src/app/page.tsx",
      "src/app/sitemap.ts",
      "src/app/robots.ts",
    ]) {
      expect(lire(chemin)).toContain("export const revalidate = 60");
    }
  });
});
