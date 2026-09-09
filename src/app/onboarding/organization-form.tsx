"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createOrganization, type OnboardingState } from "./actions";

const COUNTRIES = [
  { code: "BE", label: "Belgique" },
  { code: "FR", label: "France" },
];


export function OrganizationForm() {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    createOrganization,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      <Field
        label="Nom de l’entreprise"
        htmlFor="name"
        hint="C’est le nom que Sophie annoncera au téléphone."
        error={state.fieldErrors?.name}
      >
        <Input
          id="name"
          name="name"
          required
          autoComplete="organization"
          placeholder="Plomberie Dupont"
          invalid={Boolean(state.fieldErrors?.name)}
        />
      </Field>

      <Field label="Pays" htmlFor="countryCode" error={state.fieldErrors?.countryCode}>
        <select
          id="countryCode"
          name="countryCode"
          defaultValue="BE"
          className="min-h-12 w-full rounded-control border border-line bg-surface px-3.5 text-base text-ink"
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.label}
            </option>
          ))}
        </select>
      </Field>

      <Button type="submit" size="lg" loading={pending}>
        Continuer
      </Button>
    </form>
  );
}
