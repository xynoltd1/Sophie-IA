"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { CalendarState } from "@/lib/crm/calendar-state";
import { disconnectCalendarAction, syncCalendarAction } from "./calendar-actions";

const MESSAGES: Record<string, string> = {
  connecte: "Agenda Google connecté.",
  refuse: "Vous avez refusé l'autorisation. Rien n'a changé.",
  echec: "La connexion a échoué. Réessayez.",
  etat_invalide: "Le retour de Google n'a pas pu être vérifié. Recommencez la connexion.",
  etat_expire: "La demande a expiré. Recommencez la connexion.",
  session_differente: "La session a changé pendant l'autorisation. Recommencez.",
  reponse_incomplete: "Google a renvoyé une réponse incomplète. Réessayez.",
  droits_insuffisants: "Seul un propriétaire ou un administrateur peut connecter l'agenda.",
  non_configure:
    "L'application n'a pas encore ses identifiants Google. Cette connexion sera disponible une fois la configuration faite.",
};

export function CalendarPanel({
  state,
  canManage,
  notice,
}: {
  state: CalendarState;
  canManage: boolean;
  notice?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const ton = state.confidence === "FRESH" ? "done" : state.connected ? "attention" : "neutral";

  return (
    <div className="flex flex-col gap-2">
      {notice && MESSAGES[notice] ? (
        <p
          role="status"
          className="rounded-control bg-signal-soft px-4 py-3 text-sm text-signal-deep"
        >
          {MESSAGES[notice]}
        </p>
      ) : null}

      <Sheet tone={ton} className="flex flex-col gap-2">
        <p className="font-medium">
          {state.connected ? "Agenda Google connecté" : "Agenda Google non connecté"}
        </p>

        {state.account ? (
          <p className="text-sm text-ink-soft">{state.account}</p>
        ) : null}

        <p className="text-sm text-ink-soft">
          {state.connected
            ? "Sophie tient compte de vos rendez-vous personnels et ne proposera pas un créneau déjà pris."
            : "Sophie ne voit que les rendez-vous enregistrés ici. Elle pourrait proposer un créneau déjà occupé dans votre agenda personnel."}
        </p>

        {state.lastSyncedAt ? (
          <p className="text-sm text-ink-faint">
            Dernière synchronisation :{" "}
            {new Date(state.lastSyncedAt).toLocaleString("fr-BE", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : null}

        {state.lastError ? (
          <p className="text-sm font-medium text-urgent">{state.lastError}</p>
        ) : null}

        {message ? <p className="text-sm text-ink-soft">{message}</p> : null}

        {canManage ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {state.connected ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const resultat = await syncCalendarAction();
                      setMessage(
                        resultat.ok
                          ? `Synchronisé : ${resultat.imported} événement${resultat.imported > 1 ? "s" : ""}.`
                          : (resultat.error ?? "La synchronisation a échoué."),
                      );
                      router.refresh();
                    })
                  }
                >
                  Synchroniser maintenant
                </Button>
                <Button
                  type="button"
                  variant="quiet"
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await disconnectCalendarAction();
                      router.refresh();
                    })
                  }
                >
                  Déconnecter
                </Button>
              </>
            ) : (
              <a
                href="/api/integrations/google/start"
                className="flex min-h-12 items-center rounded-control bg-signal px-4 font-medium text-white"
              >
                Connecter mon agenda Google
              </a>
            )}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
