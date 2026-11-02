"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  RETENTION_FIELDS,
  dureeLisible,
  type RetentionSettings,
} from "@/lib/org/retention";
import { saveRetention, type RetentionState } from "./actions";

const NOMS: Record<string, string> = {
  transcript_retention_days: "transcriptions",
  summary_retention_days: "resumes",
  message_retention_days: "messages",
};

export function RetentionForm({
  initial,
  modifiable,
}: {
  initial: RetentionSettings;
  modifiable: boolean;
}) {
  const [state, action, pending] = useActionState<RetentionState, FormData>(
    saveRetention,
    {},
  );

  // On tient les valeurs en état local uniquement pour afficher la durée en
  // mots pendant la saisie. « 1095 jours » ne dit rien ; « 3 ans » se vérifie
  // d'un coup d'œil, et c'est là qu'une faute de frappe se voit.
  const [valeurs, setValeurs] = useState<Record<string, number>>({
    transcript_retention_days: initial.transcript_retention_days,
    summary_retention_days: initial.summary_retention_days,
    message_retention_days: initial.message_retention_days,
  });

  return (
    <form action={action} className="flex flex-col gap-4">
      {RETENTION_FIELDS.map((champ) => {
        const nom = NOMS[champ.champ] ?? champ.champ;
        const valeur = valeurs[champ.champ] ?? MIN_RETENTION_DAYS;
        const valide =
          valeur >= MIN_RETENTION_DAYS && valeur <= MAX_RETENTION_DAYS;

        return (
          <Sheet key={champ.champ} className="flex flex-col gap-2">
            <label htmlFor={nom} className="font-medium">
              {champ.titre}
            </label>
            <p className="text-sm text-ink-soft">{champ.detail}</p>
            <div className="flex items-center gap-2">
              <input
                id={nom}
                name={nom}
                type="number"
                inputMode="numeric"
                min={MIN_RETENTION_DAYS}
                max={MAX_RETENTION_DAYS}
                value={valeur}
                disabled={!modifiable}
                onChange={(e) =>
                  setValeurs((v) => ({
                    ...v,
                    [champ.champ]: Number(e.target.value),
                  }))
                }
                className="min-h-12 w-28 rounded-control border border-line bg-surface px-3"
              />
              <span className="text-sm text-ink-soft">
                jours{valide ? ` — ${dureeLisible(valeur)}` : ""}
              </span>
            </div>
            {!valide ? (
              <p className="text-sm text-urgent">
                Entre {MIN_RETENTION_DAYS} jours et {MAX_RETENTION_DAYS} jours
                (5 ans).
              </p>
            ) : null}
          </Sheet>
        );
      })}

      {state.error ? (
        <Sheet tone="urgent">
          <p className="text-sm">{state.error}</p>
        </Sheet>
      ) : null}
      {state.success ? (
        <Sheet tone="neutral">
          <p className="text-sm">{state.success}</p>
        </Sheet>
      ) : null}

      {modifiable ? (
        <Button type="submit" size="lg" loading={pending}>
          Enregistrer ces durées
        </Button>
      ) : (
        <p className="text-sm text-ink-soft">
          Seul le responsable de l’entreprise peut modifier ces durées.
        </p>
      )}
    </form>
  );
}
