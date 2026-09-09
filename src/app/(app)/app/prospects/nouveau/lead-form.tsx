"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { createLead, type LeadFormState } from "../actions";
import type { LeadPriority } from "@/types/database";

const PRIORITES: { valeur: LeadPriority; label: string }[] = [
  { valeur: "NORMAL", label: "Normale" },
  { valeur: "HIGH", label: "Haute" },
  { valeur: "URGENT", label: "Urgent" },
];

export function LeadForm() {
  const [state, action, pending] = useActionState<LeadFormState, FormData>(createLead, {});
  const [priorite, setPriorite] = useState<LeadPriority>("NORMAL");

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      <Field
        label="La demande"
        htmlFor="title"
        hint="En quelques mots, ce que le client veut."
        error={state.fieldErrors?.title}
      >
        <Input
          id="title"
          name="title"
          required
          placeholder="Fuite sous l’évier"
          invalid={Boolean(state.fieldErrors?.title)}
        />
      </Field>

      <Field label="Nom du client" htmlFor="contactName" error={state.fieldErrors?.contactName}>
        <Input id="contactName" name="contactName" autoComplete="off" placeholder="Jean Dupont" />
      </Field>

      <Field
        label="Téléphone"
        htmlFor="phone"
        hint="Si ce numéro est déjà connu, le prospect sera rattaché au bon client."
      >
        <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="0470 12 34 56" />
      </Field>

      <Field label="Ville" htmlFor="city">
        <Input id="city" name="city" placeholder="Namur" />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Priorité</legend>
        <input type="hidden" name="priority" value={priorite} />
        <div className="flex gap-2">
          {PRIORITES.map((option) => {
            const actif = priorite === option.valeur;
            return (
              <button
                key={option.valeur}
                type="button"
                onClick={() => setPriorite(option.valeur)}
                aria-pressed={actif}
                className={cn(
                  "min-h-12 flex-1 rounded-control border text-sm font-medium",
                  actif
                    ? option.valeur === "URGENT"
                      ? "border-urgent bg-urgent-soft text-urgent"
                      : "border-signal bg-signal-soft text-signal-deep"
                    : "border-line bg-surface text-ink-soft",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Détails" htmlFor="description">
        <textarea
          id="description"
          name="description"
          rows={4}
          className="w-full rounded-control border border-line bg-surface px-3.5 py-3 text-base text-ink"
          placeholder="Ce que le client a expliqué."
        />
      </Field>

      <Button type="submit" size="lg" loading={pending}>
        Créer le prospect
      </Button>
    </form>
  );
}
