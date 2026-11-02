"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/**
 * « Résumé indisponible — Réessayer » (section 16).
 *
 * Le bouton doit faire quelque chose. Un bouton décoratif sur un écran
 * d'erreur est pire que pas de bouton : il fait croire que le produit sait se
 * rattraper.
 */
export function ResumeActions({ callId, libelle }: { callId: string; libelle: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function reessayer() {
    setOccupe(true);
    setMessage(null);
    try {
      const reponse = await fetch(`/api/calls/${callId}/summary`, { method: "POST" });
      const corps = (await reponse.json()) as {
        ok?: boolean;
        simule?: boolean;
        erreur?: string | null;
      };

      if (corps.ok) {
        setMessage(
          corps.simule
            ? "Résumé simulé produit : aucun fournisseur d'IA n'est configuré."
            : null,
        );
        demarrer(() => router.refresh());
      } else {
        setMessage(corps.erreur ?? "La nouvelle tentative a échoué.");
      }
    } catch {
      setMessage("La demande n'a pas abouti. Vérifiez votre connexion.");
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="secondary"
        onClick={reessayer}
        loading={occupe || enCours}
        disabled={occupe || enCours}
      >
        {libelle}
      </Button>
      {message ? <p className="mt-2 text-sm text-ink-soft">{message}</p> : null}
    </div>
  );
}
