"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { reessayerMessage } from "@/app/(app)/app/agenda/actions";

export interface LigneMessage {
  id: string;
  body: string;
  status: string;
  last_error: string | null;
  created_at: string;
  attempts: number;
}

const LIBELLES: Record<string, string> = {
  QUEUED: "En attente d’envoi",
  SENDING: "Envoi en cours",
  SENT: "Envoyé",
  DELIVERED: "Reçu",
  FAILED: "Non envoyé",
};

/**
 * Les messages envoyés à ce client, et ceux qui ne sont pas partis.
 *
 * Section 26 : « SMS non envoyé — Réessayer ». Un message silencieusement
 * perdu est pire qu'un message jamais tenté : le professionnel croit que son
 * client est prévenu.
 */
export function MessagesContact({ messages }: { messages: LigneMessage[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  if (messages.length === 0) return null;

  return (
    <section>
      <SectionTitle>Messages</SectionTitle>
      {erreur ? <p className="mb-2 text-sm text-urgent">{erreur}</p> : null}
      <ul className="flex flex-col gap-2">
        {messages.map((message) => {
          const echoue =
            message.status === "FAILED" || message.status === "QUEUED";

          return (
            <li key={message.id}>
              <Sheet tone={echoue ? "attention" : "neutral"}>
                <p className="text-sm">{message.body}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {LIBELLES[message.status] ?? message.status} ·{" "}
                  {new Date(message.created_at).toLocaleString("fr-BE", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Brussels",
                  })}
                </p>
                {message.last_error ? (
                  <p className="mt-1 text-sm text-ink-soft">
                    {message.last_error}
                  </p>
                ) : null}
                {echoue ? (
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() =>
                      demarrer(async () => {
                        setErreur(null);
                        const resultat = await reessayerMessage(message.id);
                        if (!resultat.ok)
                          setErreur(
                            resultat.erreur ?? "L’envoi a encore échoué.",
                          );
                        router.refresh();
                      })
                    }
                    className="mt-2 min-h-11 rounded-control border border-attention px-3 text-sm font-medium text-attention disabled:opacity-60"
                  >
                    Réessayer l’envoi
                  </button>
                ) : null}
              </Sheet>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
