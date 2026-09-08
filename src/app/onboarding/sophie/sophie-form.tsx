"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import type { SophieStyle } from "@/types/database";
import { saveSophie, type SophieState } from "./actions";

const STYLES: { value: SophieStyle; label: string; example: string }[] = [
  {
    value: "CHALEUREUX",
    label: "Chaleureux",
    example: "Bonjour ! Je vais vous aider, dites-moi ce qui se passe.",
  },
  {
    value: "NEUTRE",
    label: "Neutre",
    example: "Bonjour, en quoi puis-je vous aider ?",
  },
  {
    value: "DIRECT",
    label: "Direct",
    example: "Bonjour. Quel est le problème ?",
  },
];

export function SophieForm({
  organizationName,
  assistantName,
  style,
  greeting,
  behaviorNotes,
  discloseAi,
}: {
  organizationName: string;
  assistantName: string;
  style: SophieStyle;
  greeting: string | null;
  behaviorNotes: string | null;
  discloseAi: boolean;
}) {
  const [state, action, pending] = useActionState<SophieState, FormData>(saveSophie, {});
  const [name, setName] = useState(assistantName);
  const [selectedStyle, setSelectedStyle] = useState(style);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      <Field
        label="Son prénom"
        htmlFor="assistantName"
        hint="C'est ainsi qu'elle se présentera à vos clients."
        error={state.fieldErrors?.assistantName}
      >
        <Input
          id="assistantName"
          name="assistantName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          invalid={Boolean(state.fieldErrors?.assistantName)}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">Son ton</legend>
        <input type="hidden" name="style" value={selectedStyle} />
        {STYLES.map((option) => {
          const active = selectedStyle === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelectedStyle(option.value)}
              aria-pressed={active}
              className={cn(
                "flex min-h-16 flex-col justify-center gap-0.5 rounded-control border px-4 py-2 text-left",
                active ? "border-signal bg-signal-soft" : "border-line bg-surface",
              )}
            >
              <span className={cn("font-medium", active && "text-signal-deep")}>
                {option.label}
              </span>
              <span className="text-sm text-ink-soft">{option.example}</span>
            </button>
          );
        })}
      </fieldset>

      <Field
        label="Sa phrase d'accueil"
        htmlFor="greeting"
        hint={`Laissez vide pour : « ${organizationName}, bonjour, ${name || "Sophie"} à l'appareil. »`}
      >
        <textarea
          id="greeting"
          name="greeting"
          rows={3}
          defaultValue={greeting ?? ""}
          className="w-full rounded-control border border-line bg-surface px-3.5 py-3 text-base text-ink"
        />
      </Field>

      <Field
        label="Consignes particulières"
        htmlFor="behaviorNotes"
        hint="Ce que Sophie doit toujours faire ou ne jamais faire. Exemple : ne jamais donner de prix au téléphone."
      >
        <textarea
          id="behaviorNotes"
          name="behaviorNotes"
          rows={4}
          defaultValue={behaviorNotes ?? ""}
          className="w-full rounded-control border border-line bg-surface px-3.5 py-3 text-base text-ink"
        />
      </Field>

      <Sheet className="flex flex-col gap-2">
        <label className="flex min-h-12 items-start gap-3 text-base">
          <input
            type="checkbox"
            name="discloseAi"
            defaultChecked={discloseAi}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-signal)]"
          />
          <span>
            Sophie précise qu&apos;elle est une assistante virtuelle
            <span className="mt-1 block text-sm text-ink-soft">
              Recommandé, et attendu en France comme en Belgique. Décocher cette case est
              un choix à valider avec votre juriste.
            </span>
          </span>
        </label>
      </Sheet>

      <Button type="submit" size="lg" loading={pending}>
        Continuer
      </Button>
    </form>
  );
}
