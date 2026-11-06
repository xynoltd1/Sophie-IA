"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  ajouterConnaissance,
  basculerConnaissance,
  supprimerConnaissance,
  type ConnaissanceState,
} from "./actions";

export interface LigneConnaissance {
  id: string;
  kind: string;
  question: string | null;
  answer: string;
  is_active: boolean;
}

const GENRES: Record<string, string> = {
  FAQ: "Question fréquente",
  INSTRUCTION: "Consigne",
  FACT: "Information",
};

export function ConnaissancesEditor({
  entrees,
}: {
  entrees: LigneConnaissance[];
}) {
  const [state, action, enCours] = useActionState<ConnaissanceState, FormData>(
    ajouterConnaissance,
    {},
  );
  const [pending, demarrer] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      {entrees.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {entrees.map((entree) => (
            <li key={entree.id}>
              <Sheet className={entree.is_active ? undefined : "opacity-60"}>
                <p className="text-sm text-ink-soft">
                  {GENRES[entree.kind] ?? entree.kind}
                </p>
                {entree.question ? (
                  <p className="font-medium">{entree.question}</p>
                ) : null}
                <p className="mt-1 whitespace-pre-line text-sm">
                  {entree.answer}
                </p>

                <div className="mt-2 flex gap-4">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      demarrer(async () => {
                        await basculerConnaissance(
                          entree.id,
                          !entree.is_active,
                        );
                        router.refresh();
                      })
                    }
                    className="text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                  >
                    {entree.is_active ? "Désactiver" : "Réactiver"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      demarrer(async () => {
                        await supprimerConnaissance(entree.id);
                        router.refresh();
                      })
                    }
                    className="text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                  >
                    Supprimer
                  </button>
                </div>
              </Sheet>
            </li>
          ))}
        </ul>
      ) : (
        <Sheet>
          <p className="text-sm text-ink-soft">
            Zeli ne connaît pour l’instant que votre entreprise, vos services
            et vos horaires. Ajoutez ici ce qu’elle doit pouvoir répondre
            d’autre.
          </p>
        </Sheet>
      )}

      <form action={action}>
        <Sheet className="flex flex-col gap-3">
          <p className="font-medium">Ajouter</p>

          <div className="flex flex-col gap-1">
            <label className="text-sm" htmlFor="kind">
              Type
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue="FAQ"
              className="min-h-12 rounded-control border border-line bg-surface px-3"
            >
              <option value="FAQ">Question fréquente</option>
              <option value="INSTRUCTION">Consigne de comportement</option>
              <option value="FACT">Information sur l’entreprise</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm" htmlFor="question">
              Question (pour une question fréquente)
            </label>
            <input
              id="question"
              name="question"
              maxLength={300}
              placeholder="Est-ce que vous vous déplacez le samedi ?"
              className="min-h-12 rounded-control border border-line px-3"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm" htmlFor="answer">
              Ce que Zeli doit dire
            </label>
            <textarea
              id="answer"
              name="answer"
              required
              rows={4}
              maxLength={4000}
              placeholder="Oui, le samedi matin uniquement, avec une majoration de 20 %."
              className="rounded-control border border-line p-3"
            />
          </div>

          {state.error ? (
            <p className="text-sm text-urgent">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-signal-deep">{state.success}</p>
          ) : null}

          <Button type="submit" loading={enCours}>
            Ajouter
          </Button>
        </Sheet>
      </form>
    </div>
  );
}
