"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { PageSeo } from "@/lib/seo/pages";
import {
  choisirProprieteConsole,
  deconnecterConsole,
  enregistrerPage,
  televerserImagePartage,
  type SeoState,
} from "./actions";

function Messages({ state }: { state: SeoState }) {
  return (
    <>
      {state.error ? (
        <p
          role="alert"
          className="rounded-control bg-urgent-soft px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-control bg-signal-soft px-3 py-2 text-sm">
          {state.success}
        </p>
      ) : null}
      {state.avertissement ? (
        <p className="rounded-control bg-attention-soft px-3 py-2.5 text-sm leading-relaxed">
          {state.avertissement}
        </p>
      ) : null}
    </>
  );
}

function Case({
  nom,
  libelle,
  aide,
  defaut,
}: {
  nom: string;
  libelle: string;
  aide: string;
  defaut: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={nom}
        defaultChecked={defaut}
        className="mt-1 size-4 shrink-0 accent-signal"
      />
      <span>
        <span className="block text-sm font-medium">{libelle}</span>
        <span className="block text-sm text-ink-soft">{aide}</span>
      </span>
    </label>
  );
}

/**
 * Le référencement d'une page.
 *
 * Les champs vides reprennent les valeurs du site : c'est voulu, et dit sur
 * l'écran. Sans cela on recopierait le même titre sur chaque page, et la
 * moindre correction demanderait de repasser partout.
 */
export function FormulairePage({ page }: { page: PageSeo }) {
  const [state, action, pending] = useActionState<SeoState, FormData>(
    enregistrerPage,
    {},
  );

  const [titre, setTitre] = useState(page.title ?? "");
  const [description, setDescription] = useState(page.description ?? "");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="path" value={page.path} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-sm font-medium">{page.path}</p>
        <p className="text-sm text-ink-faint">
          {page.updated_at
            ? `modifié le ${new Date(page.updated_at).toLocaleDateString("fr-FR")}`
            : "jamais modifié"}
        </p>
      </div>

      <Field label="Titre" htmlFor={`title-${page.path}`}>
        <Input
          id={`title-${page.path}`}
          name="title"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          maxLength={120}
          placeholder="Vide : le titre du site est utilisé"
        />
      </Field>
      {titre.length > 0 ? (
        <p className="-mt-2 text-sm text-ink-soft">
          {titre.length} caractères.{" "}
          {titre.length > 60
            ? "Au-delà de 60, Google coupe souvent la fin."
            : "Longueur correcte."}
        </p>
      ) : null}

      <Field label="Description" htmlFor={`description-${page.path}`}>
        <textarea
          id={`description-${page.path}`}
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Vide : la description du site est utilisée"
          className="w-full rounded-control border border-line bg-surface px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-signal"
        />
      </Field>
      {description.length > 0 ? (
        <p className="-mt-2 text-sm text-ink-soft">
          {description.length} caractères.{" "}
          {description.length < 50
            ? "Moins de 50 : trop court, ce sera refusé."
            : description.length > 160
              ? "Au-delà de 160, la fin est coupée dans les résultats."
              : "Longueur correcte."}
        </p>
      ) : null}

      <Field
        label="Priorité dans le plan du site"
        htmlFor={`priority-${page.path}`}
        hint="Entre 0 et 1. C’est une indication relative entre vos pages, pas un classement chez Google."
      >
        <Input
          id={`priority-${page.path}`}
          name="priority"
          type="number"
          step="0.1"
          min="0"
          max="1"
          defaultValue={page.priority}
        />
      </Field>

      <div className="flex flex-col gap-3 rounded-control bg-paper p-3">
        <Case
          nom="published"
          libelle="Page active"
          aide="Décochée, elle disparaît du plan du site. Le fichier continue de répondre."
          defaut={page.published}
        />
        <Case
          nom="indexable"
          libelle="Indexable"
          aide="Décochée, la page porte un noindex et Google la retire de ses résultats."
          defaut={page.indexable}
        />
        <Case
          nom="in_sitemap"
          libelle="Dans le plan du site"
          aide="Décochée, la page n’est plus annoncée. Google peut encore la trouver par un lien."
          defaut={page.in_sitemap}
        />
      </div>

      <Messages state={state} />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

/**
 * L'image de partage.
 *
 * Elle est téléversée chez nous, pas saisie comme adresse : une image hébergée
 * ailleurs disparaît un jour sans prévenir, et tous les liens déjà partagés
 * perdent leur aperçu en silence.
 */
export function FormulaireImagePartage({
  actuelle,
  chemins,
}: {
  actuelle: string;
  chemins: string[];
}) {
  const [state, action, pending] = useActionState<SeoState, FormData>(
    televerserImagePartage,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {actuelle ? (
        <div>
          <p className="mb-2 text-sm font-medium">Image actuelle</p>
          {/* Image externe au domaine connu seulement à l'exécution : la
              balise native évite d'avoir à déclarer le domaine au build. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={actuelle}
            alt="Aperçu de l’image de partage"
            className="w-full max-w-md rounded-control border border-line"
          />
        </div>
      ) : (
        <p className="rounded-control bg-attention-soft px-3 py-2.5 text-sm leading-relaxed">
          Aucune image de partage. Les liens vers le site apparaissent sans
          aperçu sur WhatsApp, LinkedIn et dans les messages.
        </p>
      )}

      <Field
        label="Nouvelle image"
        htmlFor="image"
        hint="PNG, JPEG ou WebP. 2 Mo maximum. Taille conseillée : 1200 × 630 pixels."
      >
        <input
          id="image"
          name="image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-control file:border-0 file:bg-paper file:px-3 file:py-1.5 file:text-sm"
        />
      </Field>

      <Field label="Appliquer à" htmlFor="cible">
        <select
          id="cible"
          name="cible"
          defaultValue="site"
          className="w-full rounded-control border border-line bg-surface px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          <option value="site">Tout le site (valeur par défaut)</option>
          {chemins.map((chemin) => (
            <option key={chemin} value={chemin}>
              La page {chemin} seulement
            </option>
          ))}
        </select>
      </Field>

      <Messages state={state} />

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer l’image"}
        </Button>
      </div>
    </form>
  );
}

/** Choix de la propriété Search Console, une fois la connexion faite. */
export function FormulaireProprieteConsole({
  proprietes,
  actuelle,
}: {
  proprietes: string[];
  actuelle: string | null;
}) {
  const [state, action, pending] = useActionState<SeoState, FormData>(
    choisirProprieteConsole,
    {},
  );

  if (proprietes.length === 0) {
    return (
      <p className="rounded-control bg-attention-soft px-3 py-2.5 text-sm leading-relaxed">
        Le compte Google connecté n’a aucune propriété vérifiée. Vérifiez
        d’abord le domaine dans Search Console : cette étape se fait chez Google
        et demande un accès au DNS.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Propriété suivie" htmlFor="propriete">
        <select
          id="propriete"
          name="propriete"
          defaultValue={actuelle ?? proprietes[0]}
          className="w-full rounded-control border border-line bg-surface px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          {proprietes.map((propriete) => (
            <option key={propriete} value={propriete}>
              {propriete}
            </option>
          ))}
        </select>
      </Field>

      <Messages state={state} />

      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Enregistrement…" : "Choisir cette propriété"}
        </Button>
      </div>
    </form>
  );
}

export function BoutonDeconnecterConsole() {
  return (
    <form action={deconnecterConsole}>
      <Button type="submit" variant="quiet">
        Déconnecter
      </Button>
    </form>
  );
}
