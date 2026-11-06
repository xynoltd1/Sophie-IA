import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PAGES_PUBLIQUES } from "../src/lib/seo/site";

const RACINE = process.cwd();
const lire = (c: string) => readFileSync(resolve(RACINE, c), "utf-8");

/**
 * Le source sans ses commentaires.
 *
 * Les verifications « rien d invente » portent sur ce que le visiteur lit,
 * pas sur ce que le code dit de lui-meme : un commentaire qui explique
 * pourquoi il n y a pas de temoignage contient le mot « temoignage ».
 */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
}

const PAGE = lire("src/app/page.tsx");
const PAGE_VISIBLE = sansCommentaires(PAGE);
const CHROME = lire("src/components/public/chrome.tsx");
const REVEAL = lire("src/components/public/reveal.tsx");

const PAGES_LEGALES = [
  "src/app/mentions-legales/page.tsx",
  "src/app/confidentialite/page.tsx",
  "src/app/cgu/page.tsx",
  "src/app/cgv/page.tsx",
  "src/app/cookies/page.tsx",
];

describe("rien d invente sur la page publique", () => {
  it("aucun temoignage, aucun avis, aucun logo de partenaire", () => {
    for (const mot of [
      "témoignage",
      "Témoignage",
      "avis client",
      "ils nous font confiance",
      "Ils nous font confiance",
      "étoiles",
    ]) {
      expect(PAGE_VISIBLE).not.toContain(mot);
    }
  });

  it("aucune statistique de performance inventee", () => {
    // Un pourcentage ou un multiplicateur sur une page commerciale est une
    // promesse chiffree. Aucune n est mesurable aujourd hui.
    expect(PAGE_VISIBLE).not.toMatch(/\d+\s?% de (clients|appels|rendez-vous)/);
    expect(PAGE_VISIBLE).not.toMatch(/\dx plus/);
    expect(PAGE_VISIBLE).not.toMatch(/\+\d+\s?(clients|artisans|entreprises)/);
  });

  it("aucun prix ecrit en dur", () => {
    // Les tarifs ne sont pas fixes. Ils viennent de la base, ou rien.
    expect(PAGE_VISIBLE).not.toMatch(/\d+\s?€/);
    expect(PAGE_VISIBLE).not.toMatch(/€\s?\d+/);
    expect(PAGE).toContain("offresPubliques");
  });

  it("un prix ne s affiche que s il existe en base", () => {
    const offres = lire("src/lib/seo/offres.ts");
    expect(offres).toContain("monthly_price_cents");
    expect(offres).toContain('typeof plan.monthly_price_cents === "number"');
    // Et seules les offres rendues publiques sortent.
    expect(offres).toContain('.eq("is_public", true)');
  });

  it("la demonstration est annoncee comme un exemple", () => {
    // Un echange ecrit a la main, montre sans le dire, se lit comme
    // l enregistrement d un vrai client.
    expect(PAGE).toContain("Exemple illustratif");
    expect(PAGE).toContain("Ce n’est pas l’enregistrement d’un vrai appel");
  });

  it("les integrations distinguent ce qui marche de ce qui est prevu", () => {
    expect(PAGE).toContain('etat: "Disponible"');
    expect(PAGE).toContain('etat: "À venir"');
    // WhatsApp n est pas developpe : il ne doit pas etre marque disponible.
    const whatsapp = PAGE.slice(PAGE.indexOf('nom: "WhatsApp"'), PAGE.indexOf('nom: "WhatsApp"') + 200);
    expect(whatsapp).toContain('etat: "À venir"');
  });
});

describe("l animation ne peut pas effacer le contenu", () => {
  it("le bloc est visible par defaut, et c est le script qui masque", () => {
    const css = lire("src/app/globals.css");
    expect(css).toContain(".reveal {\n  opacity: 1;\n}");
    // Le masquage passe par un attribut pose en JavaScript.
    expect(css).toContain('.reveal[data-cache="oui"]');
  });

  it("rien n est masque au-dessus ou dans l ecran", () => {
    // Sinon une arrivee par ancre, une position restauree ou un saut au bas
    // de la page laissent des blocs vides derriere soi.
    expect(REVEAL).toContain("rect.top <= window.innerHeight");
  });

  it("un filet rattrape un observateur silencieux", () => {
    expect(REVEAL).toContain("setTimeout(() => setVu(true), 5000)");
  });

  it("la preference de mouvement reduit est respectee", () => {
    expect(REVEAL).toContain("prefers-reduced-motion: reduce");
    expect(lire("src/app/globals.css")).toContain(
      "@media (prefers-reduced-motion: reduce)",
    );
  });

  it("aucune bibliotheque d animation n est chargee", () => {
    // Une cinquantaine de kilo-octets de JavaScript sur la page ou la
    // vitesse se paie en visiteurs perdus.
    const paquet = JSON.parse(lire("package.json")) as {
      dependencies: Record<string, string>;
    };
    for (const nom of ["framer-motion", "motion", "gsap", "three", "@react-three/fiber"]) {
      expect(paquet.dependencies[nom]).toBeUndefined();
    }
  });
});

describe("hero et illustration", () => {
  it("l illustration est dans le HTML, sans requete reseau", () => {
    // C est l element le plus large de l ecran, donc celui que Google
    // chronometre. Une image a telecharger le retarderait.
    const illu = lire("src/components/public/hero-illustration.tsx");
    expect(illu).toContain("<svg");
    expect(illu).not.toContain('"use client"');
    expect(illu).not.toMatch(/<img|background-image|url\(http/);
  });

  it("l illustration porte une description", () => {
    const illu = lire("src/components/public/hero-illustration.tsx");
    expect(illu).toContain('role="img"');
    expect(illu).toContain("aria-labelledby");
    expect(illu).toContain("<title");
  });

  it("sur telephone, le titre passe avant l illustration", () => {
    // Une illustration placee avant l accroche occupe l ecran entier : le
    // visiteur voit un dessin et doit defiler pour savoir de quoi il s agit.
    expect(PAGE).not.toContain("order-first");
    const hero = PAGE.slice(PAGE.indexOf("function HeroSection"));
    expect(hero.indexOf("<h1")).toBeLessThan(hero.indexOf("IllustrationAccueil"));
  });

  it("le positionnement est conserve", () => {
    expect(PAGE).toContain("Vous ne pouvez pas décrocher");
    expect(PAGE).toContain("Sophie, si.");
  });
});

describe("navigation et pied de page", () => {
  it("chaque lien du menu vise une ancre qui existe dans la page", () => {
    const ancres = [...CHROME.matchAll(/"\/#([a-z-]+)"/g)].map((m) => m[1]);
    expect(ancres.length).toBeGreaterThan(4);
    for (const ancre of new Set(ancres)) {
      expect(PAGE, `ancre #${ancre} absente de la page`).toContain(
        `id="${ancre}"`,
      );
    }
  });

  it("les cinq documents legaux existent et sont lies", () => {
    for (const chemin of PAGES_LEGALES) {
      expect(() => lire(chemin)).not.toThrow();
    }
    for (const lien of [
      "/mentions-legales",
      "/confidentialite",
      "/cgu",
      "/cgv",
      "/cookies",
    ]) {
      expect(CHROME).toContain(lien);
    }
  });

  it("le menu du telephone se referme et libere le defilement", () => {
    const nav = lire("src/components/public/nav.tsx");
    expect(nav).toContain('e.key === "Escape"');
    expect(nav).toContain("document.body.style.overflow");
    // Chaque lien referme : sinon la page defile derriere le panneau.
    expect(nav).toContain("onClick={() => setOuvert(false)}");
  });

  it("un lien d evitement mene au contenu", () => {
    expect(CHROME).toContain('href="#contenu"');
    expect(CHROME).toContain('id="contenu"');
  });
});

describe("documents legaux", () => {
  it("chacun porte un avertissement visible de brouillon", () => {
    const enveloppe = lire("src/components/public/legal.tsx");
    expect(enveloppe).toContain("Modèle non validé juridiquement");
    for (const chemin of PAGES_LEGALES) {
      expect(lire(chemin)).toContain("PageLegale");
    }
  });

  it("aucune identite d entreprise inventee", () => {
    // Un numero plausible se recopie ; un blanc se voit.
    for (const chemin of PAGES_LEGALES) {
      const texte = lire(chemin);
      expect(texte).not.toMatch(/BE ?0\d{9}/);
      expect(texte).not.toMatch(/\b\d{9}\b/);
      expect(texte).not.toMatch(/SIREN\s*:\s*\d/);
      expect(texte).not.toMatch(/TVA\s*:\s*[A-Z]{2}\d/);
    }
    expect(lire("src/app/mentions-legales/page.tsx")).toContain("ACompleter");
  });

  it("ils restent hors indexation et hors plan du site", () => {
    // Des conditions de vente trouvees dans Google sont lues comme les
    // conditions en vigueur, et un client pourrait s en prevaloir.
    const legal = lire("src/lib/seo/legal.ts");
    expect(legal).toContain("page?.indexable === true");
    expect(legal).toContain("{ index: false, follow: true }");

    const migration = lire(
      "supabase/migrations/20261106090000_0037_pages_legales.sql",
    );
    for (const chemin of ["/cgv", "/cgu", "/confidentialite", "/cookies"]) {
      expect(migration).toContain(`'${chemin}'`);
    }
    expect(migration).toContain("false, false, true");
  });

  it("elles sont connues du referencement, donc reglables plus tard", () => {
    const chemins = PAGES_PUBLIQUES.map((p) => p.chemin);
    for (const chemin of ["/mentions-legales", "/confidentialite", "/cgu", "/cgv", "/cookies"]) {
      expect(chemins).toContain(chemin);
    }
  });
});

describe("mesure d audience", () => {
  it("le refus de suivi du navigateur est respecte", () => {
    // La page publique sur les cookies le promet. Une promesse non tenue
    // dans un document de ce genre est pire que pas de document.
    const route = lire("src/app/api/analytics/route.ts");
    expect(route).toContain('request.headers.get("dnt") === "1"');
    expect(route).toContain('request.headers.get("sec-gpc") === "1"');

    // Et le refus tombe avant toute lecture du corps.
    const avant = route.slice(0, route.indexOf("await request.text()"));
    expect(avant).toContain("sec-gpc");
  });

  it("la page cookies ne promet pas de banniere qui n existe pas", () => {
    const cookies = lire("src/app/cookies/page.tsx");
    expect(cookies).toContain("ne dépose aucun cookie de mesure");
    expect(cookies).toContain("Global Privacy Control");
  });
});
