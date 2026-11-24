"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InputMemoire, TextareaMemoire } from "@/components/ui/champ-memoire";
import { Sheet } from "@/components/ui/sheet";
import { enregistrerClient, type DevisState } from "../actions";

/**
 * Le client du devis.
 *
 * Deux voies, et c'est voulu : choisir un contact déjà connu, ou taper un nom.
 * Un devis qui suit un appel part d'un contact que Zeli a créé ; un devis
 * commencé sur un chantier n'a souvent qu'un nom sur un bout de papier.
 * Obliger à créer la fiche d'abord ferait abandonner le devis.
 */
export function FormulaireClient({
  devisId,
  titre,
  contactId,
  nom,
  adresse,
  contacts,
  ouvert,
}: {
  devisId: string;
  titre: string;
  contactId: string | null;
  nom: string | null;
  adresse: string | null;
  contacts: { id: string; nom: string }[];
  ouvert: boolean;
}) {
  const [state, action, pending] = useActionState<DevisState, FormData>(
    enregistrerClient,
    {},
  );
  const [choisi, setChoisi] = useState(contactId ?? "");

  if (!ouvert) return null;

  return (
    <Sheet>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="quote_id" value={devisId} />

        <Field label="Objet du devis" htmlFor="title">
          <InputMemoire
            id="title"
            name="title"
            valeurInitiale={titre}
            required
            minLength={2}
            maxLength={200}
            placeholder="Débouchage, remplacement de chaudière…"
          />
        </Field>

        <Field label="Client déjà enregistré" htmlFor="contact_id">
          <select
            id="contact_id"
            name="contact_id"
            value={choisi}
            onChange={(e) => setChoisi(e.target.value)}
            className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
          >
            <option value="">Aucun — je tape le nom moi-même</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.nom}
              </option>
            ))}
          </select>
        </Field>

        {contacts.length === 0 ? (
          <p className="-mt-2 text-sm text-ink-soft">
            Aucune fiche client pour l’instant. Zeli en crée une à chaque appel ;
            en attendant, tapez le nom ci-dessous.
          </p>
        ) : null}

        <Field label="Nom du client" htmlFor="customer_name">
          <InputMemoire
            id="customer_name"
            name="customer_name"
            valeurInitiale={nom ?? ""}
            maxLength={200}
            placeholder={
              choisi ? "Laissé vide : le nom de la fiche sera utilisé" : "Jean Martin"
            }
          />
        </Field>

        <Field label="Adresse du chantier" htmlFor="customer_address">
          <TextareaMemoire
            id="customer_address"
            name="customer_address"
            valeurInitiale={adresse ?? ""}
            rows={2}
            maxLength={300}
            placeholder="Rue, numéro, code postal, ville"
          />
        </Field>

        <p className="text-sm text-ink-soft">
          Le nom et l’adresse sont recopiés dans le devis. Si la fiche du client
          change plus tard, le devis déjà envoyé garde ce qui y était écrit.
        </p>

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

        <div>
          <Button type="submit" loading={pending}>
            Enregistrer le client
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
