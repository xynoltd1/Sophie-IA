/**
 * Traduit une erreur de base en phrase utile.
 *
 * ## Le problème que ce module règle
 *
 * Trois écrans affichaient « Réessayez » quand une écriture échouait. Or la
 * cause était presque toujours la même : une migration non appliquée. La
 * colonne n'existe pas, PostgreSQL le dit clairement, et nous le cachions
 * derrière un mot qui invite à refaire exactement ce qui vient d'échouer.
 *
 * Réessayer ne répare jamais une colonne manquante. Le message doit nommer la
 * migration.
 *
 * ## Pourquoi une table de correspondance écrite à la main
 *
 * On pourrait afficher le message brut de PostgreSQL. Il est en anglais, il
 * parle de relations et de schémas, et il ne dit pas quoi faire. La table
 * ci-dessous fait le lien entre ce qui manque et le fichier à coller dans
 * l'éditeur SQL.
 *
 * Quand une migration ajoute une table ou une colonne qu'un formulaire écrit,
 * sa ligne va ici. C'est deux minutes de travail qui évitent une heure de
 * recherche à l'autre bout.
 */

/**
 * Ce qui manque, et la migration qui l'apporte.
 *
 * `quoi` nomme **l'emplacement en base**, pas la valeur saisie. La nuance
 * compte : « le nom de l'assistante n'existe pas » se lit comme un refus du
 * prénom qu'on vient de taper. C'est exactement le contresens que la première
 * version de ce module produisait.
 */
const MIGRATIONS: { marqueur: RegExp; fichier: string; quoi: string }[] = [
  {
    marqueur: /quote_lines|quote_unit_price_cents|quote_vat_rate/,
    fichier: "0039_devis",
    quoi: "les lignes de devis",
  },
  { marqueur: /\bquotes\b/, fichier: "0039_devis", quoi: "les devis" },
  {
    marqueur: /assistant_name_source/,
    fichier: "0038_assistante_zeli",
    quoi: "le nom de l’assistante",
  },
  {
    marqueur:
      /spoken_name|greeting_morning|greeting_evening|greeting_closed|notice_position|greeting_updated_at/,
    fichier: "0036_accueil_personnalise",
    quoi: "l’accueil téléphonique",
  },
  {
    marqueur: /seo_pages/,
    fichier: "0035_seo_pages",
    quoi: "le référencement",
  },
  {
    marqueur:
      /platform_settings|provider_credentials|search_console_connection/,
    fichier: "0034_platform_configuration",
    quoi: "la configuration de la plateforme",
  },
  {
    marqueur: /site_events|integration_checks/,
    fichier: "0033_analytics_and_stats",
    quoi: "les statistiques",
  },
];

/** Les codes qui veulent dire « ça n'existe pas en base ». */
const ABSENT = new Set([
  "42P01", // relation inexistante
  "42703", // colonne inexistante
  "PGRST204", // PostgREST : colonne absente du schéma
  "PGRST205", // PostgREST : table absente du schéma
]);

export interface ErreurBase {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}

/**
 * Le message à montrer.
 *
 * `secours` est la phrase utilisée quand l'erreur n'est pas une absence
 * connue : elle décrit l'action qui a échoué, dans les mots de l'écran.
 */
export function messageErreurBase(
  erreur: ErreurBase | null | undefined,
  secours: string,
  options: { pourAdmin?: boolean } = {},
): string {
  if (!erreur) return secours;

  const texte = [erreur.message, erreur.details, erreur.hint]
    .filter(Boolean)
    .join(" ");

  const manque = ABSENT.has(erreur.code ?? "");

  if (!manque) {
    // Une erreur qui n'est pas une absence mérite d'être lue telle quelle :
    // une contrainte violée, un droit refusé, un conflit. La masquer derrière
    // « Réessayez » ferait perdre la seule information disponible.
    return erreur.message ? `${secours} ${erreur.message}` : secours;
  }

  // Un artisan n'a pas à lire « appliquez une migration ». Il n'a pas accès à
  // la base, ce n'est pas son métier, et lui donner cette phrase ne fait que
  // déplacer notre faute sur lui. Il apprend seulement que sa saisie est
  // bonne et que le problème vient de nous.
  if (!options.pourAdmin) {
    return (
      "Ce que vous avez saisi est correct, mais l’enregistrement a échoué : " +
      "le service n’est pas complètement installé. Prévenez-nous, " +
      "il n’y a rien à corriger de votre côté."
    );
  }

  for (const migration of MIGRATIONS) {
    if (!migration.marqueur.test(texte)) continue;

    return (
      // La tournure met l'absence du côté de la base, jamais du côté de la
      // saisie : « le nom de l'assistante n'existe pas » se lisait comme un
      // refus du prénom qu'on venait de taper.
      "La saisie est correcte. La base de données n’est pas à jour : " +
      `il lui manque l’emplacement prévu pour ${migration.quoi}. ` +
      `Appliquez la migration ${migration.fichier} dans l’éditeur SQL de ` +
      "Supabase, puis réessayez. Le fichier est dans supabase/migrations/."
    );
  }

  return (
    "La saisie est correcte. La base de données n’est pas à jour : il lui " +
    "manque une table ou une colonne. Appliquez les migrations en attente dans " +
    `l’éditeur SQL de Supabase. Détail technique : ${erreur.message ?? erreur.code ?? "inconnu"}`
  );
}
