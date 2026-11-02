"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { repondreProposition, type ReponseClient } from "./actions";

const MESSAGES: Record<ReponseClient, string> = {
  ACCEPTE: "C’est noté, votre rendez-vous est confirmé à ce nouvel horaire.",
  REFUSE: "C’est noté. L’entreprise vous recontactera pour trouver un autre moment.",
  EXPIRE: "Cette proposition a expiré. Contactez directement l’entreprise.",
  DEJA_TRAITE: "Cette proposition a déjà reçu une réponse.",
  CRENEAU_PRIS:
    "Ce créneau vient d’être pris. L’entreprise vous proposera un autre horaire.",
  INTROUVABLE: "Ce lien n’est plus valable.",
};

export function ReponseProposition({ token }: { token: string }) {
  const [enCours, demarrer] = useTransition();
  const [reponse, setReponse] = useState<ReponseClient | null>(null);

  if (reponse) {
    return <p className="mt-5 font-medium">{MESSAGES[reponse]}</p>;
  }

  function repondre(accepte: boolean) {
    demarrer(async () => {
      const { resultat } = await repondreProposition(token, accepte);
      setReponse(resultat);
    });
  }

  return (
    <div className="mt-5 flex flex-col gap-2">
      <Button type="button" size="lg" onClick={() => repondre(true)} loading={enCours}>
        Ce nouvel horaire me convient
      </Button>
      <Button
        type="button"
        size="lg"
        variant="secondary"
        onClick={() => repondre(false)}
        disabled={enCours}
      >
        Cet horaire ne me convient pas
      </Button>
    </div>
  );
}
