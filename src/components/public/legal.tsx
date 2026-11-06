import Link from "next/link";
import { HabillagePublic, LIENS_LEGAUX } from "./chrome";

/**
 * L'habillage des pages légales.
 *
 * ## Pourquoi un bandeau impossible à rater
 *
 * Ces textes sont des brouillons. Un visiteur, un client, ou plus tard un
 * juge, ne doit pas pouvoir les prendre pour des conditions en vigueur. Le
 * bandeau est donc au-dessus du titre, pas au-dessous, et il n'est pas
 * refermable.
 *
 * ## Pourquoi les champs restent vides
 *
 * Numéro d'entreprise, adresse, TVA, hébergeur : inventer l'une de ces
 * mentions produirait un document faux sur l'identité de l'éditeur. Elles
 * apparaissent donc en clair comme « À COMPLÉTER ». Un blanc se voit ; une
 * valeur plausible se recopie.
 */
export function PageLegale({
  titre,
  mise_a_jour,
  children,
}: {
  titre: string;
  mise_a_jour: string;
  children: React.ReactNode;
}) {
  return (
    <HabillagePublic>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <p
          role="note"
          className="rounded-sheet border border-attention/30 bg-attention-soft px-5 py-4 text-sm leading-relaxed"
        >
          <strong className="block text-base">
            Modèle non validé juridiquement
          </strong>
          Ce document est un brouillon de travail. Il n’a pas été relu par un
          juriste, il contient des champs à compléter, et il n’engage personne
          en l’état. Il ne doit pas être présenté à un client comme les
          conditions en vigueur.
        </p>

        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {titre}
        </h1>
        <p className="mt-2 text-sm text-ink-faint">
          Brouillon du {mise_a_jour}. Version non opposable.
        </p>

        <div className="prose-legal mt-8 flex flex-col gap-6">{children}</div>

        <nav
          aria-label="Autres documents"
          className="mt-14 border-t border-line pt-6"
        >
          <p className="text-sm font-semibold">Les autres documents</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
            {LIENS_LEGAUX.map((lien) => (
              <li key={lien.href}>
                <Link
                  href={lien.href}
                  className="flex min-h-11 items-center text-sm text-ink-soft underline hover:text-ink"
                >
                  {lien.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </HabillagePublic>
  );
}

/** Un titre de partie, avec son contenu. */
export function Partie({
  titre,
  children,
}: {
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">{titre}</h2>
      <div className="mt-2 flex flex-col gap-3 leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

/** Un champ que seul l'éditeur peut remplir. Volontairement voyant. */
export function ACompleter({ quoi }: { quoi: string }) {
  return (
    <mark className="rounded bg-attention-soft px-1.5 py-0.5 font-medium text-attention">
      [À COMPLÉTER : {quoi}]
    </mark>
  );
}
