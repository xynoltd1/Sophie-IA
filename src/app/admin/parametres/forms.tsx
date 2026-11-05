"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import type { ReglagesSite } from "@/lib/seo/site";
import {
  enregistrerAnalytics,
  enregistrerSite,
  type ParametresState,
} from "./actions";

function Messages({ state }: { state: ParametresState }) {
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

/**
 * Réglages du site public, avec aperçu.
 *
 * L'aperçu n'est pas un ornement : un titre se juge à sa longueur dans un
 * résultat de recherche, pas au nombre de caractères. Le compteur dit la
 * limite, l'aperçu dit l'effet.
 */
export function FormulaireSite({ site }: { site: ReglagesSite }) {
  const [state, action, pending] = useActionState<ParametresState, FormData>(
    enregistrerSite,
    {},
  );

  const [titre, setTitre] = useState(site.title);
  const [description, setDescription] = useState(site.description);
  const [canonical, setCanonical] = useState(site.canonical);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Nom du site" htmlFor="name">
        <Input
          id="name"
          name="name"
          defaultValue={site.name}
          required
          maxLength={80}
        />
      </Field>

      <div>
        <Field label="Titre de la page d’accueil" htmlFor="title">
          <Input
            id="title"
            name="title"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            required
            maxLength={120}
          />
        </Field>
        <p className="mt-1 text-sm text-ink-soft">
          {titre.length} caractères.{" "}
          {titre.length > 60
            ? "Au-delà de 60, Google coupe souvent la fin."
            : "Bonne longueur."}
        </p>
      </div>

      <div>
        <Field label="Description" htmlFor="description">
          <textarea
            id="description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            minLength={50}
            maxLength={300}
            rows={3}
            className="w-full rounded-control border border-line bg-surface px-3.5 py-2.5 text-base"
          />
        </Field>
        <p className="mt-1 text-sm text-ink-soft">
          {description.length} caractères.{" "}
          {description.length > 160
            ? "Au-delà de 160, la fin n’apparaît pas dans les résultats."
            : "Bonne longueur."}
        </p>
      </div>

      <div>
        <Field label="Adresse canonique" htmlFor="canonical">
          <Input
            id="canonical"
            name="canonical"
            type="url"
            value={canonical}
            onChange={(e) => setCanonical(e.target.value)}
            required
          />
        </Field>
        <p className="mt-1 text-sm text-ink-soft">
          L’adresse officielle du site, sans barre finale. La changer ici ne
          crée ni domaine sur Vercel, ni enregistrement DNS, ni adresse de
          retour chez Google : ces trois-là se font ailleurs, et doivent se
          faire avant.
        </p>
      </div>

      <section className="rounded-sheet border border-line bg-paper p-4">
        <p className="mb-2 text-sm font-medium">
          Aperçu dans un résultat de recherche
        </p>
        <p className="truncate text-sm text-ink-faint">
          {canonical.replace(/^https?:\/\//, "")}
        </p>
        <p className="mt-0.5 truncate text-lg text-[#1a0dab]">{titre}</p>
        <p className="line-clamp-2 text-sm text-ink-soft">{description}</p>
      </section>

      <Field label="Langue et région" htmlFor="locale">
        <Input id="locale" name="locale" defaultValue={site.locale} required />
      </Field>

      <div>
        <Field label="Image de partage" htmlFor="og_image">
          <Input
            id="og_image"
            name="og_image"
            type="url"
            defaultValue={site.og_image}
            placeholder="https://…/partage.png"
          />
        </Field>
        <p className="mt-1 text-sm text-ink-soft">
          L’image qui s’affiche quand un lien est partagé sur WhatsApp ou
          LinkedIn. 1200 × 630 pixels. Vide, le lien s’affiche sans visuel.
        </p>
      </div>

      <Field label="Adresse de contact" htmlFor="contact_email">
        <Input
          id="contact_email"
          name="contact_email"
          type="email"
          defaultValue={site.contact_email}
        />
      </Field>

      <Field label="Adresse d’assistance" htmlFor="support_email">
        <Input
          id="support_email"
          name="support_email"
          type="email"
          defaultValue={site.support_email}
        />
      </Field>

      <Messages state={state} />

      <div>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

export function FormulaireAnalytics({
  active,
  exclureInterne,
}: {
  active: boolean;
  exclureInterne: boolean;
}) {
  const [state, action, pending] = useActionState<ParametresState, FormData>(
    enregistrerAnalytics,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Mesurer la fréquentation du site public" htmlFor="enabled">
        <select
          id="enabled"
          name="enabled"
          defaultValue={active ? "true" : "false"}
          className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
        >
          <option value="true">Activée</option>
          <option value="false">Désactivée</option>
        </select>
      </Field>

      <Field label="Exclure vos propres visites" htmlFor="exclude_internal">
        <select
          id="exclude_internal"
          name="exclude_internal"
          defaultValue={exclureInterne ? "true" : "false"}
          className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
        >
          <option value="true">Exclure</option>
          <option value="false">Compter</option>
        </select>
      </Field>

      <Messages state={state} />

      <div>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}
