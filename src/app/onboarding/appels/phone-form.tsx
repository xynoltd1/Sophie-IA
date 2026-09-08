"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import type { SophieAnswerMode } from "@/types/database";
import { savePhoneRules, type PhoneState } from "./actions";

const MODES: { value: SophieAnswerMode; label: string; detail: string }[] = [
  {
    value: "WHEN_UNAVAILABLE",
    label: "Quand je ne réponds pas",
    detail: "Le téléphone sonne chez vous d'abord. Sophie prend le relais après quelques sonneries.",
  },
  {
    value: "ALWAYS",
    label: "Toujours",
    detail: "Sophie décroche tous les appels. Utile quand vous êtes sur un chantier toute la journée.",
  },
  {
    value: "SCHEDULE",
    label: "Selon des horaires",
    detail: "Sophie répond en dehors de vos heures de travail. Les plages se règlent ensuite.",
  },
  {
    value: "OFF",
    label: "Jamais pour l'instant",
    detail: "Vous configurez tout maintenant et vous activerez Sophie quand vous serez prêt.",
  },
];

export function PhoneForm({
  answerMode,
  transferNumber,
}: {
  answerMode: SophieAnswerMode;
  transferNumber: string | null;
}) {
  const [state, action, pending] = useActionState<PhoneState, FormData>(savePhoneRules, {});
  const [mode, setMode] = useState(answerMode);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="answerMode" value={mode} />

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Quand Sophie doit-elle répondre ?</legend>
        {MODES.map((option) => {
          const active = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={active}
              className={cn(
                "flex min-h-16 flex-col justify-center gap-0.5 rounded-control border px-4 py-3 text-left",
                active ? "border-signal bg-signal-soft" : "border-line bg-surface",
              )}
            >
              <span className={cn("font-medium", active && "text-signal-deep")}>
                {option.label}
              </span>
              <span className="text-sm text-ink-soft">{option.detail}</span>
            </button>
          );
        })}
      </fieldset>

      {mode === "WHEN_UNAVAILABLE" ? (
        <Field
          label="Votre numéro"
          htmlFor="transferNumber"
          hint="Celui qui sonne avant que Sophie prenne le relais."
          error={state.fieldErrors?.transferNumber}
        >
          <Input
            id="transferNumber"
            name="transferNumber"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={transferNumber ?? ""}
            placeholder="0470 12 34 56"
            invalid={Boolean(state.fieldErrors?.transferNumber)}
          />
        </Field>
      ) : null}

      <Sheet className="flex flex-col gap-2 border-attention bg-attention-soft">
        <p className="font-semibold">Sophie ne décroche pas encore</p>
        <p className="text-sm text-ink-soft">
          La prise d&apos;appel réelle demande un numéro de téléphone et une intégration
          téléphonique, en cours de construction. Vos réglages sont enregistrés et
          s&apos;appliqueront dès qu&apos;elle sera active.
        </p>
      </Sheet>

      <Button type="submit" size="lg" loading={pending}>
        Terminer la configuration
      </Button>
    </form>
  );
}
