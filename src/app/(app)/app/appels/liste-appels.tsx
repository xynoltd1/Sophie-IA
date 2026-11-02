"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  CALL_STATUS_LABELS,
  formatDuration,
  formatPhone,
  momentCourt,
} from "@/lib/crm/calls";
import type { LigneAppel } from "@/lib/crm/calls-query";
import type { CallStatus } from "@/types/database";
import { mettreALaCorbeille, restaurerAppels } from "./actions";
import { cn } from "@/lib/utils/cn";

/**
 * La liste des appels, avec sélection et suppression.
 *
 * La sélection n'apparaît qu'une fois une case cochée : sur un téléphone, une
 * barre d'actions permanente mange l'écran pour une action rare.
 *
 * La suppression demande une confirmation explicite et dit ce qu'elle fait —
 * « 3 appels partent à la corbeille, récupérables 30 jours » — parce que
 * « Êtes-vous sûr ? » ne renseigne personne.
 */
export function ListeAppels({
  appels,
  peutSupprimer,
  corbeille,
}: {
  appels: LigneAppel[];
  peutSupprimer: boolean;
  corbeille: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [selection, setSelection] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function basculer(id: string) {
    setSelection((actuelle) =>
      actuelle.includes(id)
        ? actuelle.filter((x) => x !== id)
        : [...actuelle, id],
    );
  }

  function agir(action: "SUPPRIMER" | "RESTAURER") {
    demarrer(async () => {
      setMessage(null);
      const resultat =
        action === "SUPPRIMER"
          ? await mettreALaCorbeille(selection)
          : await restaurerAppels(selection);

      if (!resultat.ok) {
        setMessage(resultat.erreur ?? "L’opération a échoué.");
        return;
      }

      setSelection([]);
      setConfirmation(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p role="alert" className="text-sm font-medium text-urgent">
          {message}
        </p>
      ) : null}

      {selection.length > 0 ? (
        <Sheet
          tone="attention"
          className="sticky top-16 z-10 flex flex-col gap-2"
        >
          <p className="font-medium">
            {selection.length} appel{selection.length > 1 ? "s" : ""}{" "}
            sélectionné
            {selection.length > 1 ? "s" : ""}
          </p>

          {confirmation ? (
            <>
              <p className="text-sm text-ink-soft">
                {corbeille
                  ? "Ces appels redeviendront visibles dans la liste."
                  : `Ces appels partent à la corbeille. L’enregistrement, la transcription et le résumé partent avec eux. Les rendez-vous, contacts et demandes qui en sont issus ne sont pas touchés. Récupérable pendant 30 jours.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => agir(corbeille ? "RESTAURER" : "SUPPRIMER")}
                  className="min-h-11 rounded-control bg-urgent px-4 text-sm font-medium text-white disabled:opacity-60"
                >
                  {corbeille ? "Restaurer" : "Mettre à la corbeille"}
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => setConfirmation(false)}
                  className="min-h-11 rounded-control border border-line bg-surface px-4 text-sm"
                >
                  Annuler
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2">
              {peutSupprimer ? (
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => setConfirmation(true)}
                  className="min-h-11 rounded-control border border-urgent px-4 text-sm font-medium text-urgent disabled:opacity-60"
                >
                  {corbeille ? "Restaurer" : "Supprimer"}
                </button>
              ) : (
                <p className="text-sm text-ink-soft">
                  Seul un responsable peut supprimer des appels.
                </p>
              )}
              <button
                type="button"
                onClick={() => setSelection([])}
                className="min-h-11 rounded-control border border-line bg-surface px-4 text-sm"
              >
                Tout désélectionner
              </button>
            </div>
          )}
        </Sheet>
      ) : null}

      <ul className="flex flex-col gap-2">
        {appels.map((appel) => {
          const choisi = selection.includes(appel.id);
          const nom = appel.contact_name ?? formatPhone(appel.from_e164);

          return (
            <li key={appel.id} className="flex items-stretch gap-2">
              <label
                className="flex cursor-pointer items-center pl-1"
                aria-label={`Sélectionner l’appel de ${nom}`}
              >
                <input
                  type="checkbox"
                  checked={choisi}
                  onChange={() => basculer(appel.id)}
                  className="h-5 w-5 accent-[var(--color-signal)]"
                />
              </label>

              <Link
                href={`/app/appels/${appel.id}`}
                className="block min-w-0 flex-1"
              >
                <Sheet
                  interactive
                  tone={
                    appel.is_urgent
                      ? "urgent"
                      : appel.without_followup
                        ? "attention"
                        : "neutral"
                  }
                  className={cn(
                    "flex flex-col gap-1",
                    choisi && "ring-2 ring-signal",
                  )}
                >
                  {/* Le nom à gauche, l'heure à droite. Une liste d'appels se
                      parcourt par date : l'heure mérite sa colonne, pas une
                      place en fin de troisième ligne. */}
                  <div className="flex items-baseline gap-3">
                    <p className="min-w-0 flex-1 truncate font-medium">
                      {nom}
                      {appel.is_test ? (
                        <Badge ton="discret" className="ml-2">
                          essai
                        </Badge>
                      ) : null}
                    </p>
                    <span className="tabular shrink-0 text-sm text-ink-soft">
                      {momentCourt(appel.started_at)}
                    </span>
                  </div>

                  {appel.summary ? (
                    <p className="line-clamp-2 text-sm text-ink-soft">
                      {appel.summary}
                    </p>
                  ) : appel.without_followup ? (
                    <p className="text-sm text-attention">
                      Rien n’a été noté pendant cet appel.
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm text-ink-faint">
                    {/* L'enregistrement était un badge « Enregistrement » sur
                        presque chaque ligne : une étiquette que porte tout le
                        monde n'informe personne. Un chevron de lecture devant
                        la durée dit la même chose sans occuper de place. */}
                    <span className="tabular inline-flex items-center gap-1">
                      {appel.has_recording ? <span aria-hidden>▶</span> : null}
                      {formatDuration(appel.duration_seconds)}
                    </span>

                    {appel.is_urgent ? (
                      <Badge ton="urgent">Urgent</Badge>
                    ) : null}
                    {appel.has_appointment ? (
                      <Badge ton="signal">Rendez-vous</Badge>
                    ) : null}

                    {/* Le statut n'apparaît que lorsqu'il n'est pas celui qu'on
                        attend. « Terminé » répété dix fois ne distingue rien ;
                        « Manqué » doit sauter aux yeux. */}
                    {appel.status !== "COMPLETED" ? (
                      <Badge ton="attention">
                        {CALL_STATUS_LABELS[appel.status as CallStatus] ??
                          appel.status}
                      </Badge>
                    ) : null}
                  </div>
                </Sheet>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
