"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CALL_STATUS_LABELS, formatCallMoment, formatDuration, formatPhone } from "@/lib/crm/calls";
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
      actuelle.includes(id) ? actuelle.filter((x) => x !== id) : [...actuelle, id],
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
        <Sheet tone="attention" className="sticky top-16 z-10 flex flex-col gap-2">
          <p className="font-medium">
            {selection.length} appel{selection.length > 1 ? "s" : ""} sélectionné
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

              <Link href={`/app/appels/${appel.id}`} className="block min-w-0 flex-1">
                <Sheet
                  interactive
                  tone={appel.is_urgent ? "urgent" : appel.without_followup ? "attention" : "neutral"}
                  className={cn("flex items-start justify-between gap-3", choisi && "ring-2 ring-signal")}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {nom}
                      {appel.is_test ? (
                        <Badge ton="discret" className="ml-2">
                          essai
                        </Badge>
                      ) : null}
                    </p>

                    {appel.summary ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{appel.summary}</p>
                    ) : appel.without_followup ? (
                      <p className="mt-0.5 text-sm text-attention">
                        Rien n’a été noté pendant cet appel.
                      </p>
                    ) : null}

                    <p className="mt-1 text-sm text-ink-faint first-letter:uppercase">
                      {formatCallMoment(appel.started_at)} · {formatDuration(appel.duration_seconds)}
                    </p>

                    {appel.is_urgent || appel.has_appointment || appel.has_recording ? (
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {appel.is_urgent ? <Badge ton="urgent">Urgent</Badge> : null}
                        {appel.has_appointment ? <Badge ton="signal">Rendez-vous</Badge> : null}
                        {appel.has_recording ? <Badge ton="neutre">Enregistrement</Badge> : null}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 text-sm text-ink-soft">
                    {CALL_STATUS_LABELS[appel.status as CallStatus] ?? appel.status}
                  </span>
                </Sheet>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
