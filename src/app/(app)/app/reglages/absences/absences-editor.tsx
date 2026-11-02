"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ajouterAbsence, supprimerAbsence, type AbsenceState } from "./actions";

export interface LigneAbsence {
  id: string;
  kind: string;
  label: string | null;
  starts_at: string;
  ends_at: string;
}

const GENRES: Record<string, string> = {
  VACATION: "Vacances",
  ABSENCE: "Absence",
  HOLIDAY: "Jour férié",
};

export function AbsencesEditor({
  absences,
  timezone,
}: {
  absences: LigneAbsence[];
  timezone: string;
}) {
  const [state, action, enCours] = useActionState<AbsenceState, FormData>(ajouterAbsence, {});
  const [suppression, demarrer] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      {absences.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {absences.map((absence) => (
            <li key={absence.id}>
              <Sheet className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {absence.label || GENRES[absence.kind] || "Absence"}
                  </p>
                  <p className="text-sm text-ink-soft first-letter:uppercase">
                    {periode(absence.starts_at, absence.ends_at, timezone)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={suppression}
                  onClick={() =>
                    demarrer(async () => {
                      await supprimerAbsence(absence.id);
                      router.refresh();
                    })
                  }
                  className="shrink-0 text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                >
                  Retirer
                </button>
              </Sheet>
            </li>
          ))}
        </ul>
      ) : (
        <Sheet>
          <p className="text-sm text-ink-soft">
            Aucune absence enregistrée. Sophie propose des rendez-vous sur tous vos jours
            ouvrés.
          </p>
        </Sheet>
      )}

      <form action={action} className="flex flex-col gap-3">
        <Sheet className="flex flex-col gap-3">
          <p className="font-medium">Ajouter une absence</p>

          <div className="flex flex-col gap-1">
            <label className="text-sm" htmlFor="kind">
              Type
            </label>
            <select
              id="kind"
              name="kind"
              className="min-h-12 rounded-control border border-line bg-surface px-3"
              defaultValue="VACATION"
            >
              <option value="VACATION">Vacances</option>
              <option value="ABSENCE">Absence</option>
              <option value="HOLIDAY">Jour férié</option>
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm" htmlFor="debut">
                Du
              </label>
              <input
                id="debut"
                name="debut"
                type="date"
                required
                className="min-h-12 rounded-control border border-line px-3"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-sm" htmlFor="fin">
                Au (inclus)
              </label>
              <input
                id="fin"
                name="fin"
                type="date"
                required
                className="min-h-12 rounded-control border border-line px-3"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm" htmlFor="label">
              Intitulé (facultatif)
            </label>
            <input
              id="label"
              name="label"
              maxLength={120}
              placeholder="Congés d’été"
              className="min-h-12 rounded-control border border-line px-3"
            />
          </div>

          {state.error ? <p className="text-sm text-urgent">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-signal-deep">{state.success}</p> : null}

          <Button type="submit" loading={enCours}>
            Ajouter
          </Button>
        </Sheet>
      </form>
    </div>
  );
}

function periode(debut: string, fin: string, timezone: string): string {
  const format = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: timezone,
    });

  // La borne de fin est le lendemain à minuit : on retire une seconde pour
  // afficher le dernier jour réellement couvert.
  const dernierJour = new Date(new Date(fin).getTime() - 1000).toISOString();
  return `${format(debut)} → ${format(dernierJour)}`;
}
