"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/field";
import {
  echeanceLisible,
  enRetard,
  type TacheListee,
  type VueTaches,
} from "@/lib/crm/tasks";
import { basculerTache, creerTache, type TacheState } from "./actions";

/**
 * Une tâche se coche d'un pouce, sans ouvrir de fiche.
 *
 * La case est un vrai formulaire, pas une case à cocher qui écouterait un
 * événement : sur un chantier le réseau tombe, et une case qui a l'air cochée
 * mais n'a rien envoyé est pire qu'une case qui résiste.
 */
function LigneTache({ tache, fuseau }: { tache: TacheListee; fuseau: string }) {
  const fait = tache.status !== "OPEN";
  const retard = enRetard(tache);

  return (
    <Sheet className="flex items-start gap-3">
      <form action={basculerTache} className="pt-0.5">
        <input type="hidden" name="id" value={tache.id} />
        <input type="hidden" name="fait" value={fait ? "false" : "true"} />
        <button
          type="submit"
          aria-label={fait ? "Rouvrir la tâche" : "Marquer comme faite"}
          className="pressable flex h-7 w-7 items-center justify-center rounded-full border-2 border-line text-signal hover:border-signal"
        >
          {fait ? <span aria-hidden>✓</span> : null}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p
          className={
            fait ? "font-medium text-ink-faint line-through" : "font-medium"
          }
        >
          {tache.title}
        </p>
        {tache.description ? (
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">
            {tache.description}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span className={retard ? "font-medium text-urgent" : undefined}>
            {echeanceLisible(tache.due_at, fuseau)}
          </span>
          {tache.contact ? (
            <Link
              href={`/app/contacts/${tache.contact.id}`}
              className="underline underline-offset-2"
            >
              {tache.contact.display_name}
            </Link>
          ) : null}
          {tache.source === "SOPHIE" ? (
            <Badge ton="signal">Sophie</Badge>
          ) : null}
          {tache.priority === "URGENT" ? (
            <Badge ton="urgent">Urgent</Badge>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}

export function TaskList({
  taches,
  fuseau,
  vue,
}: {
  taches: TacheListee[];
  fuseau: string;
  vue: VueTaches;
}) {
  const [state, action, pending] = useActionState<TacheState, FormData>(
    creerTache,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      {vue !== "faites" ? (
        <Sheet className="flex flex-col gap-2">
          <form action={action} className="flex flex-col gap-2">
            <Input
              name="titre"
              placeholder="Rappeler M. Dupont"
              aria-label="Nouvelle tâche"
              required
            />
            <div className="flex items-center gap-2">
              <Input
                name="echeance"
                type="date"
                aria-label="Échéance"
                className="flex-1"
              />
              <Button type="submit" loading={pending}>
                Ajouter
              </Button>
            </div>
          </form>
          {state.error ? (
            <p className="text-sm text-urgent">{state.error}</p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-ink-soft">{state.success}</p>
          ) : null}
        </Sheet>
      ) : null}

      <ul className="flex flex-col gap-2">
        {taches.map((tache) => (
          <li key={tache.id}>
            <LigneTache tache={tache} fuseau={fuseau} />
          </li>
        ))}
      </ul>
    </div>
  );
}
