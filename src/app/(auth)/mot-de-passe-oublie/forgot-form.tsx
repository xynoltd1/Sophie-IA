"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { requestPasswordReset, type RecoveryState } from "../actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<RecoveryState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold">
          Mot de passe oublié
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Indiquez votre adresse. Nous vous envoyons un lien pour en choisir un
          nouveau.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-control bg-signal-soft px-4 py-3 text-sm text-ink">
          {state.success}
        </p>
      ) : null}

      <Field label="Adresse e-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </Field>

      <Button type="submit" size="lg" loading={pending}>
        Envoyer le lien
      </Button>
    </form>
  );
}
