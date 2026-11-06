import type { Metadata } from "next";
import Link from "next/link";
import {
  reglagesSite,
  siteIndexable,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo/site";
import { IllustrationAccueil } from "@/components/public/hero-illustration";
import { Reveal } from "@/components/public/reveal";
import { offresPubliques, type OffrePublique } from "@/lib/seo/offres";
import { pageSeo } from "@/lib/seo/pages";
import { HabillagePublic } from "@/components/public/chrome";

/**
 * Ces pages lisent des réglages en base : sans durée de revalidation, Next les
 * figerait au moment du build et un changement dans la console n'arriverait
 * sur le site qu'au redéploiement suivant. Soixante secondes : la page reste
 * servie en statique, donc rapide, et le réglage arrive dans la minute. Les
 * actions d'administration demandent en plus une revalidation immédiate.
 */
export const revalidate = 60;

/**
 * Les métadonnées viennent de la base, avec repli sur le code.
 *
 * C'est ce qui rend l'écran de réglages utile : ce que la console enregistre
 * arrive réellement dans le `<head>`. Un formulaire qui écrirait en base sans
 * que le rendu change serait une interface décorative.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [site, page] = await Promise.all([reglagesSite(), pageSeo("/")]);

  // Le réglage de la page l'emporte sur celui du site, quand il existe. Les
  // deux niveaux servent : l'un donne le ton général, l'autre affine une page
  // précise.
  const titre = page?.title?.trim() || site.title;
  const description = page?.description?.trim() || site.description;
  const image = page?.og_image?.trim() || site.og_image;

  return {
    title: titre,
    description,
    alternates: { canonical: site.canonical },
    openGraph: {
      type: "website",
      url: site.canonical,
      siteName: site.name,
      locale: site.locale,
      title: titre,
      description,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: site.name,
      description,
      images: image ? [image] : undefined,
    },
    // L'indexation ne se règle pas depuis un formulaire : elle suit
    // l'environnement. Un interrupteur qui ferait indexer une préversion
    // mettrait deux sites en concurrence sur les mêmes mots, et c'est Google
    // qui choisirait lequel montrer.
    // Deux conditions, jamais une seule : l'environnement doit autoriser
    // l'indexation, ET la page doit être marquée indexable. Un réglage de page
    // ne peut donc pas faire indexer une préversion.
    robots:
      siteIndexable() && page?.indexable !== false
        ? { index: true, follow: true }
        : { index: false, follow: false },
  };
}

// ---------------------------------------------------------------------------
// Le contenu. Tout est écrit ici, en clair, et rien n'est inventé : pas de
// témoignage, pas de logo de partenaire, pas de chiffre de performance, pas
// de prix. Ce que la page affirme, le produit le fait.
// ---------------------------------------------------------------------------

const PROBLEMES = [
  {
    titre: "Les mains prises",
    texte:
      "Sous un évier, sur un toit, les doigts dans un tableau électrique. Le téléphone sonne au pire moment.",
  },
  {
    titre: "L’appel manqué",
    texte:
      "Un numéro inconnu, pas de message. Vous ne saurez jamais si c’était un devis ou une publicité.",
  },
  {
    titre: "Le client qui rappelle ailleurs",
    texte:
      "Celui qui a une fuite n’attend pas. Il appelle le suivant dans la liste.",
  },
  {
    titre: "La demande oubliée",
    texte:
      "Notée sur un bout de carton, dans la camionnette. Retrouvée trois jours plus tard.",
  },
];

const ETAPES = [
  {
    numero: "01",
    titre: "Elle décroche",
    texte:
      "Elle répond au nom de votre entreprise, en français, et dit tout de suite qu’elle est une assistante virtuelle.",
  },
  {
    numero: "02",
    titre: "Elle comprend",
    texte:
      "Elle écoute, pose les questions de votre métier, note le nom, l’adresse et le problème. Une urgence est marquée comme telle.",
  },
  {
    numero: "03",
    titre: "Elle regarde votre agenda",
    texte:
      "Vos vrais créneaux, vos horaires, vos congés, la marge entre deux interventions. Elle propose une heure qui existe, et la bloque.",
  },
  {
    numero: "04",
    titre: "Vous décidez",
    texte:
      "Le rendez-vous arrive chez vous marqué « à valider ». Vous écoutez l’appel, lisez le résumé, acceptez d’un pouce. Le client reçoit un SMS.",
  },
];

/** L'échange montré en démonstration. Écrit à la main, et annoncé comme tel. */
const DEMONSTRATION = [
  {
    qui: "sophie",
    texte:
      "Martin Plomberie, bonjour. Je suis Sophie, votre assistante virtuelle. Comment puis-je vous aider ?",
  },
  {
    qui: "client",
    texte: "Bonjour, j’ai une fuite sous mon évier, ça coule depuis ce matin.",
  },
  {
    qui: "sophie",
    texte:
      "Je note. L’eau coule en continu, ou seulement quand vous ouvrez le robinet ?",
  },
  { qui: "client", texte: "Quand j’ouvre le robinet." },
  {
    qui: "sophie",
    texte:
      "Très bien. Je peux proposer mardi 14 h ou mercredi 9 h. Qu’est-ce qui vous arrange ?",
  },
  { qui: "client", texte: "Mardi 14 h." },
  {
    qui: "sophie",
    texte:
      "C’est noté, mardi 14 h, sous réserve de confirmation par monsieur Martin. Vous recevrez un SMS.",
  },
  {
    qui: "artisan",
    texte: "Marc ouvre la fiche le soir, écoute l’appel, accepte. Le SMS part.",
  },
];

const AVANTAGES = [
  {
    titre: "Moins d’interruptions",
    texte:
      "Vous ne vous arrêtez plus pour un appel qui pouvait attendre. Vous rappelez ce qui compte, quand vous êtes descendu de l’échelle.",
  },
  {
    titre: "Les appels suivis",
    texte:
      "Chaque appel laisse une fiche : qui, quoi, où, quand. L’enregistrement si vous l’avez activé, la transcription, le résumé.",
  },
  {
    titre: "Tout au même endroit",
    texte:
      "Les demandes ne sont plus réparties entre le répondeur, un carton et votre mémoire.",
  },
  {
    titre: "Des rendez-vous qui tiennent",
    texte:
      "Les créneaux proposés viennent de votre agenda réel, avec la marge entre deux interventions.",
  },
  {
    titre: "Une réponse immédiate",
    texte:
      "Le client a quelqu’un au bout du fil tout de suite, au lieu d’un répondeur ou d’une sonnerie dans le vide.",
  },
  {
    titre: "La décision reste à vous",
    texte:
      "Rien n’est confirmé sans votre accord tant que la validation manuelle est active. Vous pouvez refuser, déplacer, rappeler.",
  },
];

const METIERS = [
  { nom: "Plombiers", icone: "goutte" },
  { nom: "Électriciens", icone: "eclair" },
  { nom: "Serruriers", icone: "cle" },
  { nom: "Chauffagistes", icone: "flamme" },
  { nom: "Climaticiens", icone: "flocon" },
  { nom: "Garagistes", icone: "cle" },
  { nom: "Jardiniers", icone: "feuille" },
  { nom: "Peintres", icone: "pinceau" },
  { nom: "Menuisiers", icone: "regle" },
  { nom: "Nettoyage", icone: "goutte" },
  { nom: "Techniciens", icone: "eclair" },
  { nom: "Autres métiers de terrain", icone: "feuille" },
] as const;

const GARANTIES = [
  {
    titre: "Elle n’invente pas un tarif",
    texte:
      "Elle ne dit que les prix que vous avez écrits. Sinon, elle transmet la demande.",
  },
  {
    titre: "Elle n’invente pas une disponibilité",
    texte:
      "Si votre agenda est injoignable, elle note les souhaits du client et dit que vous confirmerez.",
  },
  {
    titre: "Elle ne confirme rien toute seule",
    texte:
      "Tout rendez-vous reste provisoire tant que vous ne l’avez pas accepté, lorsque la validation manuelle est active.",
  },
  {
    titre: "Elle ne donne pas de conseil technique",
    texte:
      "Elle ne vous remplace pas sur votre métier, et surtout pas sur ce qui peut être dangereux. Elle prend le message.",
  },
  {
    titre: "Elle dit qu’elle est une machine",
    texte:
      "Dès la première phrase, et ce réglage n’est pas désactivable. Si votre formule d’accueil l’oublie, la phrase est ajoutée.",
  },
  {
    titre: "Elle transmet ce qu’elle ne sait pas",
    texte:
      "Une question hors de ses connaissances devient une demande de rappel, pas une réponse approximative.",
  },
];

const INTEGRATIONS = [
  {
    nom: "Téléphonie",
    etat: "Disponible",
    texte:
      "Un numéro dédié qui sonne chez Sophie, ou le renvoi de votre propre ligne.",
  },
  {
    nom: "Google Agenda",
    etat: "Disponible",
    texte:
      "Lecture de vos créneaux réels, écriture du rendez-vous une fois accepté.",
  },
  {
    nom: "SMS",
    etat: "Disponible",
    texte: "Confirmation, modification, refus et annulation envoyés au client.",
  },
  {
    nom: "Transcription et résumé",
    etat: "Disponible",
    texte:
      "Chaque appel donne un texte lisible et un résumé, en plus de l’audio.",
  },
  {
    nom: "WhatsApp",
    etat: "À venir",
    texte: "Prévu dans l’architecture, pas encore développé.",
  },
  {
    nom: "Outlook et autres agendas",
    etat: "À venir",
    texte: "Prévu dans l’architecture, pas encore développé.",
  },
] as const;

const QUESTIONS = [
  {
    q: "Faut-il changer de numéro de téléphone ?",
    r: "Non. Vous gardez le vôtre, celui qui est sur votre camionnette et sur vos devis. Vous renvoyez vers Sophie les appels que vous ne décrochez pas, avec un code à composer sur votre téléphone.",
  },
  {
    q: "Comment Sophie répond-elle ?",
    r: "Par la voix, en français, en se présentant au nom de votre entreprise. Elle écoute la demande, pose les questions de votre métier, consulte votre agenda et propose une heure qui existe vraiment.",
  },
  {
    q: "Puis-je personnaliser son accueil ?",
    r: "Oui. Son nom, le nom prononcé de votre entreprise, la phrase d’accueil, et des formules différentes le matin, le soir et hors horaires. Un aperçu montre la phrase exacte avant d’enregistrer.",
  },
  {
    q: "Est-ce que le client sait qu’il parle à une machine ?",
    r: "Oui, dès la première phrase, et ce réglage n’est pas désactivable. Le règlement européen sur l’intelligence artificielle impose cette information, et ses obligations de transparence s’appliquent depuis le 2 août 2026. C’est aussi la seule façon honnête de procéder.",
  },
  {
    q: "Mes appels sont-ils enregistrés ?",
    r: "Seulement si vous l’activez. L’enregistrement est désactivé par défaut. Quand il est actif, l’appelant en est informé au début de l’appel, et vous choisissez combien de temps l’audio est conservé — trente jours au maximum. Les règles exactes dépendent du pays : faites valider votre configuration avant de l’utiliser avec de vrais clients.",
  },
  {
    q: "Puis-je refuser un rendez-vous ?",
    r: "Oui. Vous écoutez l’appel original, vous lisez la transcription mot pour mot, et vous acceptez, vous proposez une autre heure, ou vous refusez avec un message au client. Rien n’est confirmé sans vous.",
  },
  {
    q: "Quel agenda est compatible ?",
    r: "Google Agenda pour l’instant. La connexion prend deux minutes et se retire aussi vite. Les autres agendas sont prévus dans l’architecture mais ne sont pas développés.",
  },
  {
    q: "Comment désactiver Sophie ?",
    r: "Un interrupteur dans l’application. Elle cesse de décrocher immédiatement, et vos appels reviennent chez vous. Rien n’est supprimé : les fiches, les appels et les rendez-vous restent.",
  },
];

// ---------------------------------------------------------------------------
// Petites pièces visuelles
// ---------------------------------------------------------------------------

const CHEMINS_ICONES: Record<string, string> = {
  goutte: "M12 3c3.5 4.2 6 7.3 6 10a6 6 0 0 1-12 0c0-2.7 2.5-5.8 6-10Z",
  eclair: "M13 2 4 14h6l-1 8 9-12h-6l1-8Z",
  cle: "M14.5 3a6.5 6.5 0 0 0-6.2 8.5L2 17.8V22h4.2l1.4-1.4V19h1.6l1.4-1.4v-1.6h1.6l.9-.9A6.5 6.5 0 1 0 14.5 3Zm2.5 5.2a1.6 1.6 0 1 1 0-3.2 1.6 1.6 0 0 1 0 3.2Z",
  flamme:
    "M12 2c1 3.5-1.5 4.8-1.5 7.5A3 3 0 0 0 13 12c1.5-1 1.5-2.5 1.5-2.5C17 11 18 13 18 15a6 6 0 0 1-12 0c0-4.5 4-6.5 6-13Z",
  flocon: "M12 2v20M3.5 7l17 10M20.5 7l-17 10",
  feuille: "M4 20c0-8 5-15 16-16 1 10-4 16-11 16H4Zm3-1c3-5 6-8 9-10",
  pinceau: "M14 3l7 7-6 6-2-2-5 5a3 3 0 1 1-4-4l5-5-2-2 7-5Z",
  regle: "M3 9h18v6H3V9Zm3 0v3m3-3v3m3-3v3m3-3v3",
};

function Icone({ nom, className = "" }: { nom: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={CHEMINS_ICONES[nom] ?? CHEMINS_ICONES.feuille} />
    </svg>
  );
}

function TitreSectionPublic({
  surtitre,
  children,
  sous,
}: {
  surtitre?: string;
  children: React.ReactNode;
  sous?: string;
}) {
  return (
    <div className="max-w-2xl">
      {surtitre ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-signal">
          {surtitre}
        </p>
      ) : null}
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {children}
      </h2>
      {sous ? (
        <p className="mt-3 text-lg leading-relaxed text-ink-soft text-pretty">
          {sous}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  id,
  fond = "paper",
  children,
}: {
  id?: string;
  fond?: "paper" | "surface" | "sombre";
  children: React.ReactNode;
}) {
  const fonds = {
    paper: "bg-paper",
    surface: "bg-surface",
    sombre: "bg-console text-console-ink",
  };

  return (
    <section
      id={id}
      className={`${fonds[fond]} scroll-mt-20 px-5 py-16 sm:py-24`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// La page
// ---------------------------------------------------------------------------

export default async function AccueilPublic() {
  // Les offres viennent de la base. Un prix ne s'affiche que s'il y est : le
  // cahier des charges interdit d'en inventer, et une offre sans prix est une
  // information honnête, pas un trou.
  const offres = await offresPubliques();

  return (
    <HabillagePublic>
      <HeroSection />
      <ProblemeSection />
      <FonctionnementSection />
      <DemonstrationSection />
      <AvantagesSection />
      <MetiersSection />
      <GarantiesSection />
      <IntegrationsSection />
      <AccesSection offres={offres} />
      <QuestionsSection />
      <AppelFinalSection />
      <DonneesStructurees />
    </HabillagePublic>
  );
}

// ------------------------------------------------------------------ A. Hero

function HeroSection() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-12 sm:pb-24 sm:pt-20">
      {/* Deux voiles de couleur, très diffus. Ils donnent la profondeur sans
          image de fond à télécharger. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 480px at 78% 18%, rgba(141,220,187,0.38), transparent 62%), radial-gradient(640px 420px at 8% 72%, rgba(10,107,79,0.10), transparent 60%)",
        }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-sm text-ink-soft">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-pill bg-signal opacity-60" />
              <span className="relative inline-flex size-2 rounded-pill bg-signal" />
            </span>
            Votre secrétaire IA, pour les métiers de terrain
          </p>

          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
            Vous ne pouvez pas décrocher.
            <br />
            <span className="text-signal">Sophie, si.</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft text-pretty sm:text-xl">
            Pendant que vous travaillez, Sophie répond à vos clients, comprend
            leurs demandes et prépare vos rendez-vous. Vous gardez le contrôle,
            sans interrompre votre journée.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="pressable flex min-h-13 items-center justify-center rounded-control bg-signal px-6 text-base font-medium text-white shadow-raised transition-colors hover:bg-signal-deep"
            >
              Essayer Sophie
            </Link>
            <Link
              href="#fonctionnement"
              className="flex min-h-13 items-center justify-center rounded-control border border-line bg-surface px-6 text-base font-medium transition-colors hover:border-ink-faint"
            >
              Découvrir comment ça marche
            </Link>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-ink-faint">
            Plombiers, électriciens, serruriers, chauffagistes, garagistes,
            jardiniers — et tout métier où l’on travaille avec les mains.
          </p>
        </div>

        {/* Le titre d'abord, toujours. Sur un téléphone, une illustration
            placée avant l'accroche occupe l'écran entier : le visiteur voit un
            dessin et doit faire défiler pour apprendre de quoi il s'agit. Elle
            est aussi bornée en largeur, sinon elle remplit la hauteur de
            l'écran à elle seule. */}
        <div className="mx-auto w-full max-w-[340px] sm:max-w-[420px] lg:max-w-none">
          <IllustrationAccueil />
        </div>
      </div>
    </section>
  );
}

// -------------------------------------------------------------- B. Problème

function ProblemeSection() {
  return (
    <Section fond="surface">
      <Reveal>
        <TitreSectionPublic
          surtitre="Le problème"
          sous="Un artisan ne rate pas ses appels par négligence. Il les rate parce qu’il travaille."
        >
          Le téléphone sonne toujours au mauvais moment
        </TitreSectionPublic>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PROBLEMES.map((probleme, index) => (
          <Reveal key={probleme.titre} delai={index * 70}>
            <div className="h-full rounded-sheet border border-line bg-paper p-5 transition-transform hover:-translate-y-0.5">
              <p className="font-display text-lg font-semibold">
                {probleme.titre}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {probleme.texte}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// --------------------------------------------------------- C. Fonctionnement

function FonctionnementSection() {
  return (
    <Section id="fonctionnement">
      <Reveal>
        <TitreSectionPublic
          surtitre="Comment ça marche"
          sous="Quatre étapes. La dernière est la vôtre, et elle le reste."
        >
          Un appel, de bout en bout
        </TitreSectionPublic>
      </Reveal>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ETAPES.map((etape, index) => (
          <Reveal key={etape.numero} delai={index * 80}>
            <li className="relative h-full list-none overflow-hidden rounded-sheet border border-line bg-surface p-6 shadow-sheet transition-transform hover:-translate-y-1">
              <span
                aria-hidden="true"
                className="absolute -right-2 -top-4 font-display text-[5rem] font-semibold leading-none text-signal-tint"
              >
                {etape.numero}
              </span>
              <p className="relative font-display text-xl font-semibold">
                {etape.titre}
              </p>
              <p className="relative mt-2 text-sm leading-relaxed text-ink-soft">
                {etape.texte}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

// -------------------------------------------------------- D. Démonstration

function DemonstrationSection() {
  return (
    <Section id="demonstration" fond="surface">
      <Reveal>
        <TitreSectionPublic
          surtitre="Démonstration"
          sous="Un appel comme il se déroule vraiment, de la sonnerie au SMS de confirmation."
        >
          Ce que le client entend
        </TitreSectionPublic>
      </Reveal>

      <Reveal delai={80}>
        <p className="mt-4 inline-flex items-center gap-2 rounded-pill bg-attention-soft px-3 py-1.5 text-sm">
          <span aria-hidden="true">●</span>
          Exemple illustratif. Ce n’est pas l’enregistrement d’un vrai appel.
        </p>
      </Reveal>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="rounded-sheet border border-line bg-paper p-5 sm:p-7">
          <ol className="flex flex-col gap-3">
            {DEMONSTRATION.map((ligne, index) => (
              <Reveal key={index} delai={index * 60}>
                <li
                  className={`flex list-none ${
                    ligne.qui === "client" ? "justify-end" : "justify-start"
                  }`}
                >
                  {ligne.qui === "artisan" ? (
                    <p className="w-full rounded-control border border-dashed border-line px-4 py-3 text-sm leading-relaxed text-ink-soft">
                      {ligne.texte}
                    </p>
                  ) : (
                    <div className="max-w-[88%]">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                        {ligne.qui === "sophie" ? "Sophie" : "Le client"}
                      </p>
                      <p
                        className={`rounded-sheet px-4 py-3 text-[0.95rem] leading-relaxed ${
                          ligne.qui === "sophie"
                            ? "bg-signal text-white"
                            : "border border-line bg-surface"
                        }`}
                      >
                        {ligne.texte}
                      </p>
                    </div>
                  )}
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delai={120}>
          <div className="rounded-sheet border border-line bg-paper p-6">
            <p className="font-display text-xl font-semibold">
              Ce qui vous arrive, à vous
            </p>
            <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-ink-soft">
              {[
                "Une notification : « rendez-vous à valider ».",
                "La fiche d’appel : nom, numéro, adresse, problème.",
                "L’enregistrement, si vous l’avez activé.",
                "La transcription, mot pour mot.",
                "Le résumé en trois lignes.",
                "Trois boutons : accepter, modifier, refuser.",
              ].map((item) => (
                <li key={item} className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-1.5 text-signal">
                    ▸
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------- E. Avantages

function AvantagesSection() {
  return (
    <Section>
      <Reveal>
        <TitreSectionPublic surtitre="Ce que ça change">
          Votre journée, sans le téléphone qui la coupe
        </TitreSectionPublic>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AVANTAGES.map((avantage, index) => (
          <Reveal key={avantage.titre} delai={(index % 3) * 70}>
            <div className="h-full rounded-sheet border border-line bg-surface p-6 transition-transform hover:-translate-y-1">
              <p className="font-display text-lg font-semibold">
                {avantage.titre}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {avantage.texte}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// --------------------------------------------------------------- F. Métiers

function MetiersSection() {
  return (
    <Section id="metiers" fond="surface">
      <Reveal>
        <TitreSectionPublic
          surtitre="Les métiers"
          sous="Sophie n’est pas écrite pour un métier. Vous choisissez le vôtre à l’inscription, et elle adapte ses questions, ses urgences et ses durées d’intervention."
        >
          Pour ceux qui travaillent avec les mains
        </TitreSectionPublic>
      </Reveal>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {METIERS.map((metier, index) => (
          <Reveal key={metier.nom} delai={(index % 4) * 50}>
            <div className="flex h-full items-center gap-3 rounded-sheet border border-line bg-paper px-4 py-4 transition-colors hover:border-signal">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-signal-soft text-signal">
                <Icone nom={metier.icone} />
              </span>
              <span className="text-sm font-medium leading-snug">
                {metier.nom}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------- G. Garanties

function GarantiesSection() {
  return (
    <Section id="garanties">
      <Reveal>
        <TitreSectionPublic
          surtitre="Les garde-fous"
          sous="C’est la partie que les autres ne mettent pas sur leur site. Une assistante qui improvise vous coûte un client ; mieux vaut qu’elle dise qu’elle transmet."
        >
          Ce que Sophie ne fera jamais
        </TitreSectionPublic>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {GARANTIES.map((garantie, index) => (
          <Reveal key={garantie.titre} delai={(index % 3) * 70}>
            <div className="h-full rounded-sheet border border-line bg-surface p-6">
              <span
                aria-hidden="true"
                className="mb-3 flex size-9 items-center justify-center rounded-control bg-signal-soft text-signal"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l7 3v6c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6l7-3Z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </span>
              <p className="font-display text-lg font-semibold">
                {garantie.titre}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {garantie.texte}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ----------------------------------------------------------- H. Intégrations

const TONS_ETAT: Record<string, string> = {
  Disponible: "bg-signal-soft text-signal",
  "En préparation": "bg-attention-soft text-attention",
  "À venir": "bg-ink-tint text-ink-soft",
};

function IntegrationsSection() {
  return (
    <Section id="integrations" fond="surface">
      <Reveal>
        <TitreSectionPublic
          surtitre="Intégrations"
          sous="Ce qui est marqué « disponible » fonctionne. Ce qui est marqué « à venir » est prévu dans l’architecture, et rien de plus."
        >
          Ce à quoi Sophie se connecte
        </TitreSectionPublic>
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((integration, index) => (
          <Reveal key={integration.nom} delai={(index % 3) * 70}>
            <div className="flex h-full flex-col rounded-sheet border border-line bg-paper p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-lg font-semibold">
                  {integration.nom}
                </p>
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-1 text-xs font-semibold ${
                    TONS_ETAT[integration.etat] ?? TONS_ETAT["À venir"]
                  }`}
                >
                  {integration.etat}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {integration.texte}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ----------------------------------------------------------------- I. Accès

function AccesSection({ offres }: { offres: OffrePublique[] }) {
  return (
    <Section id="acces">
      <Reveal>
        <TitreSectionPublic
          surtitre="Accès"
          sous="Sophie ouvre progressivement. Créez votre compte, configurez votre entreprise, et testez-la avant de la mettre sur votre vraie ligne."
        >
          Commencer
        </TitreSectionPublic>
      </Reveal>

      {offres.length > 0 ? (
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {offres.map((offre, index) => (
            <Reveal key={offre.code} delai={index * 80}>
              <div className="flex h-full flex-col rounded-sheet border border-line bg-surface p-6">
                <p className="font-display text-xl font-semibold">
                  {offre.label}
                </p>
                {offre.description ? (
                  <p className="mt-1 text-sm text-ink-soft">
                    {offre.description}
                  </p>
                ) : null}

                <p className="mt-4 font-display text-2xl font-semibold">
                  {offre.prix ?? (
                    <span className="text-lg font-medium text-ink-soft">
                      Tarif à venir
                    </span>
                  )}
                </p>

                <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-ink-soft">
                  <li>{offre.minutes} minutes d’appel incluses</li>
                  <li>{offre.sms} SMS inclus</li>
                  <li>
                    {offre.membres === 1
                      ? "1 utilisateur"
                      : `${offre.membres ?? "Plusieurs"} utilisateurs`}
                  </li>
                </ul>

                <Link
                  href="/signup"
                  className="pressable mt-6 flex min-h-12 items-center justify-center rounded-control bg-signal px-4 font-medium text-white"
                >
                  Créer mon compte
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      ) : (
        <Reveal delai={60}>
          <div className="mt-10 rounded-sheet border border-line bg-surface p-7 sm:p-9">
            <p className="max-w-2xl text-lg leading-relaxed">
              Les tarifs ne sont pas encore fixés, et nous préférons l’écrire
              plutôt que d’afficher un prix que nous changerions le mois
              prochain.
            </p>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
              La création de compte est ouverte. Vous configurez votre
              entreprise, votre métier et votre accueil, et vous testez Sophie
              sans la mettre sur votre vraie ligne. Nous reviendrons vers vous
              avant toute mise en service payante.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="pressable flex min-h-13 items-center justify-center rounded-control bg-signal px-6 font-medium text-white"
              >
                Créer mon compte
              </Link>
              <Link
                href="#questions"
                className="flex min-h-13 items-center justify-center rounded-control border border-line px-6 font-medium"
              >
                Lire les questions fréquentes
              </Link>
            </div>
          </div>
        </Reveal>
      )}
    </Section>
  );
}

// -------------------------------------------------------------- J. Questions

function QuestionsSection() {
  return (
    <Section id="questions" fond="surface">
      <Reveal>
        <TitreSectionPublic surtitre="Questions fréquentes">
          Les questions qu’on nous pose
        </TitreSectionPublic>
      </Reveal>

      <div className="mt-10 grid gap-3 lg:grid-cols-2">
        {QUESTIONS.map((question, index) => (
          <Reveal key={question.q} delai={(index % 2) * 60}>
            <details className="group h-full rounded-sheet border border-line bg-paper open:bg-surface">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium">
                {question.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-ink-faint transition-transform group-open:rotate-45"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-soft">
                {question.r}
              </p>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ----------------------------------------------------------- K. Appel final

function AppelFinalSection() {
  return (
    <section className="relative overflow-hidden bg-console px-5 py-20 text-console-ink sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(700px 360px at 50% 0%, rgba(75,199,149,0.22), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Vos clients appellent. Continuez à travailler.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-console-ink-soft text-pretty">
          Créez votre compte, dites à Sophie ce que vous faites, connectez votre
          agenda. Le reste se passe pendant que vous travaillez.
        </p>
        <Link
          href="/signup"
          className="pressable mt-8 inline-flex min-h-13 items-center justify-center rounded-control bg-console-accent px-7 text-base font-semibold text-console shadow-raised"
        >
          Créer mon compte
        </Link>
        <p className="mt-4 text-sm text-console-ink-soft">
          Configuration guidée. Vous pouvez tester Sophie avant de la mettre sur
          votre ligne.
        </p>
      </div>
    </section>
  );
}

// --------------------------------------------------------- Données structurées

/**
 * Ce que Google lit sans l'afficher.
 *
 * Seulement deux types, et seulement ce qui est vrai : l'organisation, et les
 * questions fréquentes telles qu'elles sont écrites plus haut. Pas de note
 * moyenne, pas d'avis, pas de prix — les inventer ferait écrire à Google des
 * choses fausses sous notre nom, et c'est une sanction quand il s'en aperçoit.
 */
function DonneesStructurees() {
  const donnees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        description:
          "Secrétaire téléphonique par intelligence artificielle pour les artisans et les professionnels de terrain.",
        areaServed: ["FR", "BE"],
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Secrétaire téléphonique par intelligence artificielle : elle répond aux appels, qualifie la demande, consulte l'agenda et prépare un rendez-vous que le professionnel valide.",
        // Aucune note moyenne, aucune offre chiffrée : aucun tarif n'est
        // fixé, et personne n'a encore noté le produit. Déclarer l'un ou
        // l'autre ferait écrire à Google une chose fausse sous notre nom.
      },
      {
        "@type": "FAQPage",
        mainEntity: QUESTIONS.map((question) => ({
          "@type": "Question",
          name: question.q,
          acceptedAnswer: { "@type": "Answer", text: question.r },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Contenu écrit dans ce fichier, jamais saisi par un utilisateur.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees) }}
    />
  );
}
