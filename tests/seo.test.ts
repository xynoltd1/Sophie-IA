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
    const accueil = lire("src/app/(public)/page.tsx");
    const bloc = accueil.slice(accueil.indexOf("donneesStructurees"));
    expect(bloc).toContain("SoftwareApplication");
    expect(bloc).not.toContain("aggregateRating");
    expect(bloc).not.toContain('"offers"');
  });

  it("il existe au moins une page publique indexable", () => {
    // Le site a longtemps redirige sa racine vers la connexion : tout travail
    // de referencement portait alors sur rien.
    expect(existsSync(resolve(RACINE, "src/app/(public)/page.tsx"))).toBe(true);
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
