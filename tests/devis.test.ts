import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  euros,
  ligneHorsTva,
  ligneTva,
  modifiable,
  totaux,
} from "../src/lib/quotes/totals";

const lire = (c: string) => readFileSync(resolve(process.cwd(), c), "utf-8");
const MIGRATION = lire("supabase/migrations/20261119140000_0039_devis.sql");

describe("l argent ne derape pas", () => {
  it("une quantite a virgule ne perd pas de centime", () => {
    // 1,15 x 100 centimes vaut 114,999... en virgule flottante.
    expect(ligneHorsTva({ quantity: 1.15, unit_price_cents: 100, vat_rate: 21 })).toBe(115);
    expect(ligneHorsTva({ quantity: 0.1, unit_price_cents: 300, vat_rate: 21 })).toBe(30);
    expect(ligneHorsTva({ quantity: 2.5, unit_price_cents: 6500, vat_rate: 21 })).toBe(16250);
  });

  it("le total est la somme exacte des lignes affichees", () => {
    // Le client additionne ce qu il voit : les deux doivent coincider.
    const lignes = [
      { quantity: 1.5, unit_price_cents: 6500, vat_rate: 21 },
      { quantity: 3, unit_price_cents: 1299, vat_rate: 21 },
      { quantity: 1, unit_price_cents: 4500, vat_rate: 6 },
    ];

    const somme = lignes.reduce((t, l) => t + ligneHorsTva(l), 0);
    expect(totaux(lignes).horsTva).toBe(somme);
    expect(totaux(lignes).ttc).toBe(
      totaux(lignes).horsTva + totaux(lignes).tva,
    );
  });

  it("la TVA se calcule sur le montant deja arrondi", () => {
    // 9750 centimes a 21 % = 2047,5 -> 2048.
    expect(ligneTva({ quantity: 1.5, unit_price_cents: 6500, vat_rate: 21 })).toBe(2048);
    expect(ligneTva({ quantity: 1, unit_price_cents: 10000, vat_rate: 6 })).toBe(600);
    expect(ligneTva({ quantity: 1, unit_price_cents: 10000, vat_rate: 0 })).toBe(0);
  });

  it("deux taux dans un meme devis sont separes", () => {
    // En Belgique, un chantier mele couramment 6 % et 21 %.
    const detail = totaux([
      { quantity: 1, unit_price_cents: 10000, vat_rate: 6 },
      { quantity: 1, unit_price_cents: 10000, vat_rate: 21 },
    ]).parTaux;

    expect(detail).toHaveLength(2);
    expect(detail[0]).toEqual({ taux: 6, base: 10000, tva: 600 });
    expect(detail[1]).toEqual({ taux: 21, base: 10000, tva: 2100 });
  });

  it("un devis vide vaut zero, pas NaN", () => {
    expect(totaux([])).toEqual({ horsTva: 0, tva: 0, ttc: 0, parTaux: [] });
  });

  it("les montants s affichent en euros", () => {
    expect(euros(123450)).toContain("1");
    expect(euros(123450)).toContain("234,50");
  });

  it("aucun montant n est stocke en nombre a virgule", () => {
    expect(MIGRATION).toContain("unit_price_cents int not null");
    expect(MIGRATION).toContain("total_excl_cents int not null");
    expect(MIGRATION).not.toMatch(/price.*(float|double|real)/i);
  });
});

describe("les totaux ne viennent jamais du navigateur", () => {
  it("la base les recalcule par declencheur", () => {
    // Un total envoye par le client est un total qu il choisit.
    expect(MIGRATION).toContain("recompute_quote_totals");
    expect(MIGRATION).toContain("create trigger quote_lines_totaux");
    expect(MIGRATION).toContain("after insert or update or delete on public.quote_lines");
  });

  it("le formulaire n envoie pas de total", () => {
    const action = lire("src/app/(app)/app/devis/actions.ts");
    expect(action).not.toMatch(/total_(excl|vat|incl)_cents\s*:/);
    expect(action).toContain("unit_price_cents: Math.round(ligne.unit_price * 100)");
  });

  it("l apercu utilise la meme fonction que le reste", () => {
    // Un apercu qui recalculerait de son cote finirait par montrer autre
    // chose que ce qui est enregistre.
    const editeur = lire("src/app/(app)/app/devis/[id]/editor.tsx");
    expect(editeur).toContain("ligneHorsTva");
    expect(editeur).not.toMatch(/\*\s*quantity\s*\*/);
  });

  it("l ecran signale un ecart au lieu de le cacher", () => {
    const page = lire("src/app/(app)/app/devis/[id]/page.tsx");
    expect(page).toContain("calcul.ttc !== devis.total_incl_cents");
    expect(page).toContain("ne transmettez pas ce devis");
  });
});

describe("un devis fige ne bouge plus", () => {
  it("la base refuse toute ecriture de ligne apres l envoi", () => {
    // Sinon l entreprise detient une version et le client une autre.
    expect(MIGRATION).toContain("quote_lines_figees");
    expect(MIGRATION).toContain("create trigger quote_lines_verrou");
    expect(MIGRATION).toContain("before insert or update or delete");
  });

  it("l ecran grise les boutons, sans s y fier", () => {
    expect(modifiable("BROUILLON")).toBe(true);
    for (const etat of ["ENVOYE", "ACCEPTE", "REFUSE", "EXPIRE"] as const) {
      expect(modifiable(etat)).toBe(false);
    }
  });
});

describe("la numerotation", () => {
  it("n arrive qu a l envoi, jamais a la creation", () => {
    // Un brouillon abandonne laisserait un trou dans la serie.
    expect(MIGRATION).toContain("constraint quotes_reference_coherente");
    expect(MIGRATION).toContain("(status = 'BROUILLON') = (reference is null)");

    const action = lire("src/app/(app)/app/devis/actions.ts");
    const creation = action.slice(
      action.indexOf("export async function creerDevis"),
      action.indexOf("export async function ajouterLigne"),
    );
    expect(creation).not.toContain("reference");
  });

  it("deux envois simultanes ne prennent pas le meme numero", () => {
    expect(MIGRATION).toContain("pg_advisory_xact_lock");
    // Et la contrainte tient meme si quelqu un insere directement en base.
    expect(MIGRATION).toContain("create unique index if not exists quotes_numero_unique");
  });

  it("la fonction de numerotation est refusee au navigateur", () => {
    expect(MIGRATION).toContain(
      "revoke all on function public.assign_quote_reference(uuid) from public, anon, authenticated",
    );
    expect(MIGRATION).toContain("security definer");
    expect(MIGRATION).toContain("set search_path = public, pg_temp");
  });
});

describe("isolation entre entreprises", () => {
  it("les deux tables ont RLS et leurs politiques", () => {
    expect(MIGRATION).toContain("alter table public.quotes      enable row level security");
    expect(MIGRATION).toContain("alter table public.quote_lines enable row level security");
    for (const table of ["quotes", "quote_lines"]) {
      expect(MIGRATION).toContain(`on public.${table} for select to authenticated`);
      expect(MIGRATION).toContain(`on public.${table} for all to authenticated`);
    }
    // Trois par table : la lecture, puis l ecriture avec sa verification.
    expect(MIGRATION.match(/is_org_member/g)?.length).toBeGreaterThanOrEqual(6);
  });

  it("une ligne porte son organisation, sans jointure", () => {
    // La politique peut trancher seule, et une ligne ne peut pas se
    // retrouver rattachee au devis d une autre entreprise.
    const lignes = MIGRATION.slice(MIGRATION.indexOf("create table if not exists public.quote_lines"));
    expect(lignes).toContain("organization_id uuid not null references public.organizations");
  });

  it("TRUNCATE reste hors de portee", () => {
    // Le privilege qui traverse toute l architecture d isolation.
    expect(MIGRATION).toContain("revoke truncate, references, trigger on public.quotes      from anon, authenticated");
    expect(MIGRATION).toContain("revoke truncate, references, trigger on public.quote_lines from anon, authenticated");
  });
});

describe("ce que Zeli ne voit pas", () => {
  it("le prix de devis d un service n est lu par aucun outil vocal", () => {
    // Section 9 : Zeli n enonce que price_indication, du texte ecrit par
    // l entreprise. Un nombre l inviterait a calculer.
    const outils = lire("src/lib/sophie/tools.ts");
    expect(outils).not.toContain("quote_unit_price_cents");
    expect(outils).not.toContain("quote_vat_rate");

    expect(MIGRATION).toContain("Aucun outil vocal ne lit cette colonne");
  });

  it("aucun outil vocal ne touche aux devis", () => {
    const outils = lire("src/lib/sophie/tools.ts");
    expect(outils).not.toMatch(/\bquotes\b|quote_lines/);
  });
});

describe("pas de factures", () => {
  it("aucune table de facture n est creee", () => {
    expect(MIGRATION).not.toMatch(/create table.*invoice/i);
    expect(MIGRATION).not.toMatch(/create table.*facture/i);
  });

  it("la raison est ecrite, pas seulement la decision", () => {
    expect(MIGRATION).toContain("1er janvier 2026");
    expect(MIGRATION).toContain("Peppol");
    expect(lire("docs/ROADMAP.md")).toContain("Les factures ne seront pas dans Zelicall");
  });

  it("l ecran le dit au professionnel", () => {
    expect(lire("src/app/(app)/app/devis/page.tsx")).toContain(
      "ne produit pas de factures",
    );
  });
});

describe("le bouton dit ce qu il fait", () => {
  it("figer n est pas presente comme un envoi au client", () => {
    // A cette etape rien ne part chez le client : annoncer un envoi serait
    // un bouton decoratif.
    const editeur = lire("src/app/(app)/app/devis/[id]/editor.tsx");
    expect(editeur).toContain("Figer et numéroter");
    expect(editeur).toContain("pas encore transmis au client");
  });

  it("un devis sans ligne ne peut pas etre fige", () => {
    const action = lire("src/app/(app)/app/devis/actions.ts");
    expect(action).toContain("total_incl_cents as number) <= 0");
  });
});

describe("une erreur de creation se lit a l ecran", () => {
  const action = lire("src/app/(app)/app/devis/actions.ts");

  it("la creation rend un message, elle ne leve plus d exception", () => {
    // Une exception dans une action serveur ne remonte pas a l ecran : Next
    // affiche « Application error » et un numero. L artisan voit une page
    // blanche et ne sait pas quoi faire.
    const creation = action.slice(
      action.indexOf("export async function creerDevis"),
      action.indexOf("export async function ajouterLigne"),
    );
    expect(creation).not.toContain("throw new Error");
    expect(creation).toContain("messageErreurBase(error");
  });

  it("la migration manquante est nommee, pas traduite en jargon", () => {
    // La traduction vit maintenant dans un module partage : les trois ecrans
    // qui ecrivent en base donnent le meme message.
    expect(action).toContain("messageErreurBase");
    expect(lire("src/lib/db/erreurs.ts")).toContain("0039_devis");
  });

  it("la liste distingue « aucun devis » de « table absente »", () => {
    // Avaler l erreur afficherait « aucun devis » alors que la base n est
    // pas a jour : on chercherait l erreur au mauvais endroit.
    const requetes = lire("src/lib/quotes/queries.ts");
    expect(requetes).toContain('tableAbsente: error?.code === "42P01"');
    expect(lire("src/app/(app)/app/devis/page.tsx")).toContain("tableAbsente");
  });
});
