"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { setNewPassword, type RecoveryState } from "../actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<RecoveryState, FormData>(
    setNewPassword,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-xl font-semibold">
          Nouveau mot de passe
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Au moins 8 caractères. Vous serez connectée aussitôt.
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

      <Field label="Nouveau mot de passe" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Field label="Répétez-le" htmlFor="confirmation">
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      <Button type="submit" size="lg" loading={pending}>
        Enregistrer
      </Button>
    </form>
  );
}
