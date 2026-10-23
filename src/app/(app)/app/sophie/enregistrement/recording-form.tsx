"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { saveRecordingPolicy, type RecordingState } from "./actions";

export function RecordingForm({
  accepteInitial,
  enregistreInitial,
  retentionInitiale,
  modifiable,
}: {
  accepteInitial: boolean;
  enregistreInitial: boolean;
  retentionInitiale: number;
  modifiable: boolean;
}) {
  const [state, action, pending] = useActionState<RecordingState, FormData>(
    saveRecordingPolicy,
    {},
  );

  // L'acceptation commande l'activation : on ne peut pas cocher « conserver »
  // sans avoir accepté, et décocher l'acceptation éteint la conservation.
  const [accepte, setAccepte] = useState(accepteInitial);
  const [enregistrer, setEnregistrer] = useState(enregistreInitial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Sheet className="flex flex-col gap-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="accepte"
            checked={accepte}
            disabled={!modifiable}
            onChange={(e) => {
              setAccepte(e.target.checked);
              if (!e.target.checked) setEnregistrer(false);
            }}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-signal)]"
          />
          <span className="text-sm">
            J’ai lu ce qui précède. J’accepte d’être responsable des enregistrements
            conservés par mon entreprise, et de pouvoir les supprimer sur demande d’un
            client.
          </span>
        </label>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="enregistrer"
            checked={enregistrer}
            disabled={!modifiable || !accepte}
            onChange={(e) => setEnregistrer(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-signal)]"
          />
          <span className="text-sm">
            Conserver l’enregistrement de mes appels dans mon espace privé.
            {!accepte ? (
              <span className="mt-1 block text-ink-soft">
                Acceptez d’abord le paragraphe ci-dessus.
              </span>
            ) : null}
          </span>
        </label>

        <div>
          <label htmlFor="retention" className="text-sm font-medium">
            Durée de conservation
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="retention"
              name="retention"
              type="number"
              min={1}
              max={30}
              defaultValue={retentionInitiale}
              disabled={!modifiable}
              className="min-h-12 w-24 rounded-control border border-line bg-surface px-3"
            />
            <span className="text-sm text-ink-soft">jours (30 au maximum)</span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Passé ce délai, l’enregistrement est supprimé. La transcription et le résumé,
            eux, restent sur la fiche d’appel.
          </p>
        </div>
      </Sheet>

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
          Enregistrer ce réglage
        </Button>
      ) : (
        <p className="text-sm text-ink-soft">
          Seul le responsable de l’entreprise peut modifier ce réglage.
        </p>
      )}
    </form>
  );
}
