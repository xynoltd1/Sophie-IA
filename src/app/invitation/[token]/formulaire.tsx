"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { accepterInvitation, type ResultatInvitation } from "./actions";

const MESSAGES: Record<ResultatInvitation, string> = {
  OK: "C’est fait, vous faites partie de l’entreprise.",
  INTROUVABLE: "Cette invitation n’existe pas ou a été annulée.",
  EXPIREE: "Cette invitation a expiré. Demandez-en une nouvelle.",
  DEJA_ACCEPTEE: "Cette invitation a déjà été utilisée.",
  AUTRE_ADRESSE:
    "Vous êtes connecté avec une autre adresse que celle invitée. Déconnectez-vous et reconnectez-vous avec la bonne.",
  ECHEC: "Quelque chose a échoué. Réessayez dans un instant.",
};

export function FormulaireInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [resultat, setResultat] = useState<ResultatInvitation | null>(null);

  if (resultat === "OK") {
    return (
      <div className="mt-5 flex flex-col gap-3">
        <p className="font-medium">{MESSAGES.OK}</p>
        <Button type="button" size="lg" onClick={() => router.push("/app")}>
          Ouvrir l’application
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      {resultat ? <p className="text-sm text-attention">{MESSAGES[resultat]}</p> : null}
      <Button
        type="button"
        size="lg"
        loading={enCours}
        onClick={() => demarrer(async () => setResultat(await accepterInvitation(token)))}
      >
        Rejoindre l’entreprise
      </Button>
    </div>
  );
}
