"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { changerMotDePasse, changerNom, type CompteState } from "./actions";

function Message({ state }: { state: CompteState }) {
  if (state.error) {
    return (
      <p
        role="alert"
        className="rounded-control bg-urgent-soft px-3 py-2 text-sm"
      >
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="rounded-control bg-signal-soft px-3 py-2 text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}

export function FormulaireNom({ nom }: { nom: string }) {
  const [state, action, pending] = useActionState<CompteState, FormData>(
    changerNom,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Nom affiché" htmlFor="nom">
        <Input id="nom" name="nom" defaultValue={nom} required minLength={2} />
      </Field>
      <Message state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

export function FormulaireMotDePasse() {
  const [state, action, pending] = useActionState<CompteState, FormData>(
    changerMotDePasse,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Mot de passe actuel" htmlFor="actuel">
        <Input
          id="actuel"
          name="actuel"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field label="Nouveau mot de passe" htmlFor="nouveau">
        <Input
          id="nouveau"
          name="nouveau"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <Field label="Répétez le nouveau" htmlFor="confirmation">
        <Input
          id="confirmation"
          name="confirmation"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>
      <Message state={state} />
      <div>
        <Button type="submit" loading={pending}>
          Changer le mot de passe
        </Button>
      </div>
    </form>
  );
}
