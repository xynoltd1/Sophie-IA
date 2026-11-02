"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { enregistrerPlan, type PlanState } from "./actions";

export interface LignePlan {
  code: string;
  label: string;
  description: string | null;
  monthly_price_cents: number | null;
  included_voice_minutes: number;
  included_sms: number;
  max_members: number | null;
  is_public: boolean;
}

export function PlansEditor({ plans }: { plans: LignePlan[] }) {
  const [state, action, enCours] = useActionState<PlanState, FormData>(enregistrerPlan, {});
  const [ouvert, setOuvert] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {plans.map((plan) => (
          <li key={plan.code}>
            <Sheet className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {plan.label}
                  {!plan.is_public ? (
                    <span className="ml-2 text-sm font-normal text-ink-soft">(non publiée)</span>
                  ) : null}
                </p>
                <p className="text-sm text-ink-soft">
                  {plan.included_voice_minutes} min de voix · {plan.included_sms} SMS ·{" "}
                  {plan.max_members ? `${plan.max_members} membres` : "membres illimités"}
                </p>
                {plan.description ? (
                  <p className="mt-1 text-sm text-ink-soft">{plan.description}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-sm font-medium">
                {plan.monthly_price_cents === null
                  ? "Prix à fixer"
                  : `${(plan.monthly_price_cents / 100).toFixed(2)} €`}
              </span>
            </Sheet>
          </li>
        ))}
      </ul>

      {!ouvert ? (
        <Button type="button" variant="secondary" onClick={() => setOuvert(true)}>
          Ajouter ou modifier une offre
        </Button>
      ) : (
        <form action={action}>
          <Sheet className="flex flex-col gap-3">
            <Champ nom="code" libelle="Code (ex. PRO)" requis />
            <Champ nom="label" libelle="Nom affiché" requis />
            <Champ nom="description" libelle="Description (facultatif)" />
            <Champ nom="prixEuros" libelle="Prix mensuel en euros (vide = à fixer)" />
            <div className="flex gap-3">
              <Champ nom="minutes" libelle="Minutes incluses" type="number" defaut="0" />
              <Champ nom="sms" libelle="SMS inclus" type="number" defaut="0" />
            </div>
            <Champ nom="membres" libelle="Membres maximum (vide = illimité)" type="number" />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isPublic"
                className="h-5 w-5 accent-[var(--color-signal)]"
              />
              Offre publiée
            </label>

            {state.error ? <p className="text-sm text-urgent">{state.error}</p> : null}
            {state.success ? <p className="text-sm text-signal-deep">{state.success}</p> : null}

            <div className="flex gap-2">
              <Button type="submit" loading={enCours}>
                Enregistrer
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOuvert(false)}>
                Fermer
              </Button>
            </div>
          </Sheet>
        </form>
      )}
    </div>
  );
}

function Champ({
  nom,
  libelle,
  type = "text",
  requis = false,
  defaut,
}: {
  nom: string;
  libelle: string;
  type?: string;
  requis?: boolean;
  defaut?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={nom}>
        {libelle}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        required={requis}
        defaultValue={defaut}
        className="min-h-12 rounded-control border border-line px-3"
      />
    </div>
  );
}
