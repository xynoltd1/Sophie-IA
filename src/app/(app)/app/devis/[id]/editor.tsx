"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import {
  euros,
  ligneHorsTva,
  TAUX_TVA,
  type EtatDevis,
} from "@/lib/quotes/totals";
import {
  ajouterLigne,
  deciderDevis,
  envoyerDevis,
  supprimerLigne,
  type DevisState,
} from "../actions";

interface LigneAffichee {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unit_price_cents: number;
  vat_rate: number;
}

interface ServiceProposable {
  id: string;
  name: string;
  unit_price_cents: number | null;
  vat_rate: number | null;
}

function Message({ state }: { state: DevisState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-control bg-urgent-soft px-3 py-2.5 text-sm"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-control bg-signal-soft px-3 py-2.5 text-sm leading-relaxed">
        {state.success}
      </p>
    );
  }
  return null;
}

/**
 * Les lignes du devis.
 *
 * ## Le total de la ligne se calcule pendant la saisie
 *
 * Avec la même fonction que le serveur. L'artisan voit le montant avant de
 * valider : une erreur de virgule se corrige en regardant, pas en
 * enregistrant puis en relisant.
 *
 * ## Un service pré-remplit, il ne décide pas
 *
 * Choisir un service recopie son libellé et, s'il en a un, son prix de devis.
 * Les deux restent modifiables : le prix d'un chantier dépend du chantier.
 */
export function EditeurLignes({
  devisId,
  lignes,
  services,
  ouvert,
}: {
  devisId: string;
  lignes: LigneAffichee[];
  services: ServiceProposable[];
  ouvert: boolean;
}) {
  const [state, action, pending] = useActionState<DevisState, FormData>(
    ajouterLigne,
    {},
  );

  const [label, setLabel] = useState("");
  const [quantite, setQuantite] = useState("1");
  const [prix, setPrix] = useState("");
  const [taux, setTaux] = useState("21");

  const apercu = ligneHorsTva({
    quantity: Number(quantite.replace(",", ".")) || 0,
    unit_price_cents: Math.round((Number(prix.replace(",", ".")) || 0) * 100),
    vat_rate: Number(taux) || 0,
  });

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-ink-soft">Lignes</p>

      {lignes.length === 0 ? (
        <Sheet tone="neutral">
          <p className="text-sm text-ink-soft">
            Aucune ligne. Ajoutez ce que vous allez facturer : main-d’œuvre,
            déplacement, pièces.
          </p>
        </Sheet>
      ) : (
        <ul className="flex flex-col gap-2">
          {lignes.map((ligne) => (
            <li key={ligne.id}>
              <Sheet className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{ligne.label}</p>
                  <p className="text-sm text-ink-soft">
                    {ligne.quantity} {ligne.unit ?? ""} ×{" "}
                    {euros(ligne.unit_price_cents)} · TVA {ligne.vat_rate} %
                  </p>
                  {ligne.description ? (
                    <p className="mt-1 text-sm text-ink-faint">
                      {ligne.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="font-medium tabular-nums">
                    {euros(ligneHorsTva(ligne))}
                  </p>
                  {ouvert ? (
                    <form action={supprimerLigne}>
                      <input type="hidden" name="ligne_id" value={ligne.id} />
                      <input type="hidden" name="quote_id" value={devisId} />
                      <button
                        type="submit"
                        className="min-h-11 text-sm text-urgent hover:underline"
                      >
                        Retirer
                      </button>
                    </form>
                  ) : null}
                </div>
              </Sheet>
            </li>
          ))}
        </ul>
      )}

      {ouvert ? (
        <form
          action={action}
          className="flex flex-col gap-3 rounded-sheet border border-line bg-surface p-4"
        >
          <input type="hidden" name="quote_id" value={devisId} />

          {services.length > 0 ? (
            <Field label="Partir d’un service" htmlFor="service">
              <select
                id="service"
                name="service_id"
                defaultValue=""
                onChange={(e) => {
                  const service = services.find((s) => s.id === e.target.value);
                  if (!service) return;
                  setLabel(service.name);
                  if (service.unit_price_cents !== null) {
                    setPrix((service.unit_price_cents / 100).toFixed(2));
                  }
                  if (service.vat_rate !== null) {
                    setTaux(String(service.vat_rate));
                  }
                }}
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
              >
                <option value="">Saisie libre</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          <Field label="Désignation" htmlFor="label">
            <Input
              id="label"
              name="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={200}
              placeholder="Main-d’œuvre, remplacement du siphon…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantité" htmlFor="quantity">
              <Input
                id="quantity"
                name="quantity"
                inputMode="decimal"
                value={quantite}
                onChange={(e) => setQuantite(e.target.value)}
                required
              />
            </Field>
            <Field label="Unité" htmlFor="unit">
              <Input
                id="unit"
                name="unit"
                maxLength={20}
                placeholder="h, m², pièce"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix unitaire hors TVA" htmlFor="unit_price">
              <Input
                id="unit_price"
                name="unit_price"
                inputMode="decimal"
                value={prix}
                onChange={(e) => setPrix(e.target.value)}
                required
                placeholder="65,00"
              />
            </Field>
            <Field label="TVA" htmlFor="vat_rate">
              <select
                id="vat_rate"
                name="vat_rate"
                value={taux}
                onChange={(e) => setTaux(e.target.value)}
                className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
              >
                {TAUX_TVA.map((option) => (
                  <option key={option.taux} value={option.taux}>
                    {option.libelle}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-sm text-ink-soft">
            Cette ligne :{" "}
            <strong className="tabular-nums">{euros(apercu)}</strong> hors TVA.
          </p>

          <Message state={state} />

          <Button type="submit" disabled={pending}>
            {pending ? "Ajout…" : "Ajouter la ligne"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

/**
 * Figer, puis classer.
 *
 * Le bouton dit « Figer », pas « Envoyer au client » : à cette étape rien ne
 * part chez le client. Le lien public et le PDF viennent ensuite. Un bouton
 * qui annoncerait un envoi sans envoyer serait décoratif.
 */
export function ActionsDevis({
  devisId,
  etat,
  total,
  autorise,
}: {
  devisId: string;
  etat: EtatDevis;
  total: number;
  autorise: boolean;
}) {
  const [envoi, actionEnvoi, envoiEnCours] = useActionState<
    DevisState,
    FormData
  >(envoyerDevis, {});
  const [decision, actionDecision, decisionEnCours] = useActionState<
    DevisState,
    FormData
  >(deciderDevis, {});

  if (!autorise) return null;

  if (etat === "BROUILLON") {
    return (
      <form action={actionEnvoi} className="flex flex-col gap-3">
        <input type="hidden" name="quote_id" value={devisId} />
        <Message state={envoi} />
        <Button type="submit" size="lg" disabled={envoiEnCours || total <= 0}>
          {envoiEnCours ? "En cours…" : "Figer et numéroter"}
        </Button>
        <p className="text-sm leading-relaxed text-ink-faint">
          Le devis reçoit son numéro et ses lignes deviennent définitives. Il
          n’est pas encore transmis au client : l’envoi arrive à la prochaine
          étape.
        </p>
      </form>
    );
  }

  if (etat === "ENVOYE") {
    return (
      <div className="flex flex-col gap-3">
        <Message state={decision} />
        <div className="grid grid-cols-2 gap-3">
          <form action={actionDecision}>
            <input type="hidden" name="quote_id" value={devisId} />
            <input type="hidden" name="decision" value="ACCEPTE" />
            <Button
              type="submit"
              size="lg"
              disabled={decisionEnCours}
              className="w-full"
            >
              Accepté
            </Button>
          </form>
          <form action={actionDecision}>
            <input type="hidden" name="quote_id" value={devisId} />
            <input type="hidden" name="decision" value="REFUSE" />
            <Button
              type="submit"
              size="lg"
              variant="secondary"
              disabled={decisionEnCours}
              className="w-full"
            >
              Refusé
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
