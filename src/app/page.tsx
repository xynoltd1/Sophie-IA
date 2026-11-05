import type { Metadata } from "next";
import Link from "next/link";
import { reglagesSite, siteIndexable } from "@/lib/seo/site";
import { HabillagePublic } from "@/components/public/chrome";

/**
 * Les métadonnées viennent de la base, avec repli sur le code.
 *
 * C'est ce qui rend l'écran de réglages utile : ce que la console enregistre
 * arrive réellement dans le `<head>`. Un formulaire qui écrirait en base sans
 * que le rendu change serait une interface décorative.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await reglagesSite();

  return {
    title: site.title,
    description: site.description,
    alternates: { canonical: site.canonical },
    openGraph: {
      type: "website",
      url: site.canonical,
      siteName: site.name,
      locale: site.locale,
      title: site.title,
      description: site.description,
      images: site.og_image ? [{ url: site.og_image }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: site.name,
      description: site.description,
      images: site.og_image ? [site.og_image] : undefined,
    },
    // L'indexation ne se règle pas depuis un formulaire : elle suit
    // l'environnement. Un interrupteur qui ferait indexer une préversion
    // mettrait deux sites en concurrence sur les mêmes mots, et c'est Google
    // qui choisirait lequel montrer.
    robots: siteIndexable()
      ? { index: true, follow: true }
      : { index: false, follow: false },
  };
}

const ETAPES = [
  {
    titre: "Elle décroche",
    texte:
      "Un client appelle pendant que vous êtes sous un évier ou sur un toit. Sophie répond en français, se présente, et dit qu'elle est une assistante virtuelle.",
  },
  {
    titre: "Elle comprend",
    texte:
      "Elle écoute la demande, pose les questions de votre métier, note le nom, l'adresse et le problème. Si c'est une urgence, elle le marque.",
  },
  {
    titre: "Elle regarde votre agenda",
    texte:
      "Vos vrais créneaux, vos horaires, vos congés, la marge entre deux interventions. Elle propose une heure qui existe, et bloque le créneau.",
  },
  {
    titre: "Vous décidez",
    texte:
      "Le rendez-vous arrive chez vous marqué « à valider ». Vous écoutez l'appel, lisez le résumé, acceptez d'un pouce. Le client reçoit un SMS.",
  },
] as const;

const JAMAIS = [
  {
    titre: "Elle n'invente pas un tarif",
    texte:
      "Elle ne dit que les prix que vous avez écrits. Sinon, elle transmet la demande.",
  },
  {
    titre: "Elle n'invente pas une disponibilité",
    texte:
      "Si votre agenda est injoignable, elle note les souhaits du client et dit que vous confirmerez.",
  },
  {
    titre: "Elle ne confirme rien toute seule",
    texte:
      "Tout rendez-vous est provisoire tant que vous ne l'avez pas accepté.",
  },
  {
    titre: "Elle ne donne pas de conseil technique",
    texte: "Elle ne vous remplace pas sur votre métier. Elle prend le message.",
  },
] as const;

const QUESTIONS = [
  {
    q: "Faut-il changer de numéro de téléphone ?",
    r: "Non. Vous gardez le vôtre, celui qui est sur votre camionnette et sur vos devis. Vous renvoyez vers Sophie les appels que vous ne décrochez pas, avec un code à composer sur votre téléphone.",
  },
  {
    q: "Est-ce que le client sait qu'il parle à une machine ?",
    r: "Oui, toujours. Sophie l'annonce au début de l'appel, et ce réglage n'est pas désactivable. C'est une obligation européenne depuis août 2026, et c'est aussi la seule façon honnête de procéder.",
  },
  {
    q: "Est-ce que les appels sont enregistrés ?",
    r: "Seulement si vous l'activez. L'enregistrement est désactivé par défaut, l'appelant doit en être informé, et vous choisissez combien de temps l'audio est conservé — trente jours au maximum.",
  },
  {
    q: "Et si Sophie se trompe ?",
    r: "Vous écoutez l'appel original et vous lisez la transcription, mot pour mot. Rien n'est confirmé sans vous : vous pouvez refuser le rendez-vous, proposer une autre heure, ou rappeler vous-même.",
  },
  {
    q: "Quel agenda faut-il ?",
    r: "Google Agenda pour l'instant. La connexion prend deux minutes et se retire aussi vite.",
  },
] as const;

/**
 * Page d'accueil publique.
 *
 * C'était jusqu'ici une redirection vers la page de connexion : le site
 * n'avait donc **aucune page indexable**, et tout travail de référencement
 * aurait porté sur rien.
 *
 * ## La ligne éditoriale
 *
 * Aucun chiffre inventé, aucun témoignage, aucun logo de client. Le produit
 * n'a pas encore de client : l'écrire serait un mensonge, et un mensonge
 * vérifiable. Ce qui tient lieu d'argument, ce sont les limites — la section
 * « ce que Sophie ne fera jamais » dit à un artisan méfiant des outils
 * automatiques exactement ce qu'il veut savoir, et aucun concurrent ne l'écrit.
 */
export default async function AccueilPublic() {
  const site = await reglagesSite();

  const donneesStructurees = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site.canonical}/#organisation`,
        name: site.name,
        url: site.canonical,
        description: site.description,
        areaServed: ["FR", "BE"],
      },
      {
        "@type": "SoftwareApplication",
        name: site.name,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: site.canonical,
        description: site.description,
        inLanguage: "fr",
        // Ni prix ni note : les tarifs ne sont pas fixés et le produit n'a
        // reçu aucun avis. Déclarer l'un ou l'autre serait une donnée
        // structurée trompeuse, que Google sanctionne et qui tromperait
        // surtout les gens.
      },
      {
        "@type": "FAQPage",
        mainEntity: QUESTIONS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.r },
        })),
      },
    ],
  };

  return (
    <HabillagePublic>
      <script
        type="application/ld+json"
        // Contenu écrit par nous, jamais saisi par un utilisateur.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }}
      />

      <section className="border-b border-line bg-gradient-to-b from-signal-tint to-paper">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
          <p className="font-medium text-signal-deep">
            Pour les métiers de terrain
          </p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Vous ne pouvez pas décrocher. Sophie, si.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Pendant que vous êtes les mains dans un chantier, elle répond,
            comprend la demande, regarde votre agenda et vous propose le
            rendez-vous. Vous validez d’un pouce, le soir, depuis votre
            téléphone.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="pressable flex min-h-13 items-center rounded-control bg-signal px-6 text-base font-medium text-white"
            >
              Essayer Sophie
            </Link>
            <Link
              href="#fonctionnement"
              className="flex min-h-13 items-center rounded-control border border-line bg-surface px-6 text-base font-medium"
            >
              Voir comment ça marche
            </Link>
          </div>

          <p className="mt-5 text-sm text-ink-faint">
            Plombiers, électriciens, serruriers, chauffagistes, garagistes,
            jardiniers — et tout métier où l’on travaille avec les mains.
          </p>
        </div>
      </section>

      <section id="fonctionnement" className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Un appel, de bout en bout
        </h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {ETAPES.map((etape, index) => (
            <li
              key={etape.titre}
              className="rounded-sheet border border-line bg-surface p-6 shadow-sheet"
            >
              <span className="tabular text-sm font-semibold text-signal">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-2 font-display text-xl font-semibold">
                {etape.titre}
              </h3>
              <p className="mt-2 leading-relaxed text-ink-soft">
                {etape.texte}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Ce que Sophie ne fera jamais
          </h2>
          <p className="mt-3 max-w-2xl text-ink-soft">
            C’est la partie que les autres ne mettent pas sur leur site. Une
            assistante qui improvise vous coûte un client ; mieux vaut qu’elle
            dise qu’elle transmet.
          </p>
          <div className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2">
            {JAMAIS.map((item) => (
              <div key={item.titre} className="spine border-l-signal pl-4">
                <h3 className="font-semibold">{item.titre}</h3>
                <p className="mt-1 leading-relaxed text-ink-soft">
                  {item.texte}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Les questions qu’on nous pose
        </h2>
        <dl className="mt-8 divide-y divide-line overflow-hidden rounded-sheet border border-line bg-surface">
          {QUESTIONS.map((item) => (
            <div key={item.q} className="px-6 py-5">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-1.5 leading-relaxed text-ink-soft">{item.r}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-line bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-5 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Un appel manqué, c’est un chantier perdu
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-paper/70">
            Créez votre compte, dites à Sophie ce que vous faites, connectez
            votre agenda. Le reste se passe pendant que vous travaillez.
          </p>
          <Link
            href="/signup"
            className="pressable mt-8 inline-flex min-h-13 items-center rounded-control bg-signal px-7 text-base font-medium text-white"
          >
            Créer mon compte
          </Link>
        </div>
      </section>
    </HabillagePublic>
  );
}
