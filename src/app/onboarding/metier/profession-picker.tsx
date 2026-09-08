"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils/cn";
import { chooseProfession, type StepState } from "./actions";

interface TemplateOption {
  id: string;
  slug: string;
  label: string;
  allows_custom_label: boolean;
}

export function ProfessionPicker({
  templates,
  currentTemplateId,
  currentCustomLabel,
}: {
  templates: TemplateOption[];
  currentTemplateId: string | null;
  currentCustomLabel: string | null;
}) {
  const [state, action, pending] = useActionState<StepState, FormData>(chooseProfession, {});
  const [selected, setSelected] = useState<string | null>(currentTemplateId);

  const needsCustomLabel = templates.find((t) => t.id === selected)?.allows_custom_label ?? false;

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      <input type="hidden" name="templateId" value={selected ?? ""} />

      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Choisissez votre métier</legend>
        {templates.map((template) => {
          const active = selected === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setSelected(template.id)}
              aria-pressed={active}
              className={cn(
                "flex min-h-14 items-center justify-between rounded-control border px-4 text-left text-base",
                active
                  ? "border-signal bg-signal-soft font-medium text-signal-deep"
                  : "border-line bg-surface text-ink",
              )}
            >
              {template.label}
              {active ? <span aria-hidden>✓</span> : null}
            </button>
          );
        })}
      </fieldset>

      {state.fieldErrors?.templateId ? (
        <p role="alert" className="text-sm font-medium text-urgent">
          {state.fieldErrors.templateId}
        </p>
      ) : null}

      {needsCustomLabel ? (
        <Field
          label="Précisez votre métier"
          htmlFor="customLabel"
          hint="C'est le terme que Sophie emploiera avec vos clients."
        >
          <Input
            id="customLabel"
            name="customLabel"
            required
            defaultValue={currentCustomLabel ?? ""}
            placeholder="Vitrier"
          />
        </Field>
      ) : null}

      <Button type="submit" size="lg" loading={pending} disabled={!selected}>
        Continuer
      </Button>
    </form>
  );
}
