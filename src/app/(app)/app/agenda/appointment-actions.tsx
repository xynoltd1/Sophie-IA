"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { appointmentActions } from "@/lib/crm/agenda";
import {
  annulerRendezVous,
  confirmerRendezVous,
  proposerAutreHoraire,
  refuserRendezVous,
  retryCalendarSync,
  type ResultatDecision,
} from "./actions";
import type { AppointmentStatus } from "@/types/database";
import { cn } from "@/lib/utils/cn";

type Formulaire = "REFUS" | "ANNULATION" | "PROPOSITION" | null;

/**
 * Les décisions du professionnel sur un rendez-vous (sections 22 à 25).
 *
 * Refuser et annuler ouvrent un formulaire au lieu d'agir tout de suite. Ce
 * n'est pas une friction gratuite : ces deux gestes préviennent un client, et
 * le motif part dans le message. Un refus sans explication, c'est un client
 * perdu qui ne saura jamais pourquoi.
 *
 * Proposer un autre horaire est le troisième choix, celui qui manquait. Sans
 * lui, un artisan qui ne peut pas honorer un créneau n'a que « refuser ».
 */
export function AppointmentActions({
  appointmentId,
  status,
  syncError = false,
  dureeMinutes = 60,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  syncError?: boolean;
  dureeMinutes?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [formulaire, setFormulaire] = useState<Formulaire>(null);
  const [motif, setMotif] = useState("");
  const [prevenir, setPrevenir] = useState(true);
  const [nouvelHoraire, setNouvelHoraire] = useState("");
  const router = useRouter();

  const actions = appointmentActions(status);
  const peutRefuser = actions.includes("REJECTED");
  const peutAnnuler = actions.includes("CANCELLED");
  const peutConfirmer = actions.includes("CONFIRMED");
  const peutProposer = status === "PENDING_APPROVAL" || status === "CONFIRMED";

  if (actions.length === 0 && !syncError && !peutProposer) return null;

  function traiter(promesse: Promise<ResultatDecision>) {
    startTransition(async () => {
      setError(null);
      setInfo(null);
      const resultat = await promesse;

      if (resultat.error) {
        setError(resultat.error);
        return;
      }

      const messages = [
        resultat.success,
        resultat.warning,
        resultat.smsEnAttente
          ? "Le message au client n’est pas parti : aucun opérateur SMS n’est configuré. Il reste en attente."
          : null,
      ].filter(Boolean);

      setInfo(messages.join(" "));
      setFormulaire(null);
      setMotif("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm font-medium text-urgent">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="text-sm text-attention">
          {info}
        </p>
      ) : null}

      {syncError ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const resultat = await retryCalendarSync(appointmentId);
              if (!resultat.ok) setError(resultat.error ?? "Échec.");
              else router.refresh();
            })
          }
          className="min-h-11 self-start rounded-control border border-attention px-3 text-sm font-medium text-attention disabled:opacity-60"
        >
          Réessayer l&apos;écriture dans Google
        </button>
      ) : null}

      {formulaire === null ? (
        <div className="flex flex-wrap gap-2">
          {peutConfirmer ? (
            <Bouton
              principal
              disabled={pending}
              onClick={() => traiter(confirmerRendezVous(appointmentId))}
            >
              Accepter
            </Bouton>
          ) : null}
          {peutProposer ? (
            <Bouton
              disabled={pending}
              onClick={() => setFormulaire("PROPOSITION")}
            >
              Proposer un autre horaire
            </Bouton>
          ) : null}
          {peutRefuser ? (
            <Bouton disabled={pending} onClick={() => setFormulaire("REFUS")}>
              Refuser
            </Bouton>
          ) : null}
          {peutAnnuler ? (
            <Bouton
              disabled={pending}
              onClick={() => setFormulaire("ANNULATION")}
            >
              Annuler
            </Bouton>
          ) : null}
        </div>
      ) : null}

      {formulaire === "REFUS" || formulaire === "ANNULATION" ? (
        <div className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
          <label
            className="text-sm font-medium"
            htmlFor={`motif-${appointmentId}`}
          >
            Motif {formulaire === "REFUS" ? "du refus" : "de l’annulation"}{" "}
            (facultatif)
          </label>
          <input
            id={`motif-${appointmentId}`}
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            maxLength={200}
            placeholder="Chantier en cours, pièce manquante…"
            className="min-h-12 rounded-control border border-line px-3"
          />
          <p className="text-sm text-ink-soft">
            Ce motif est envoyé au client. N’y mettez rien que vous ne lui
            diriez pas.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prevenir}
              onChange={(e) => setPrevenir(e.target.checked)}
              className="h-5 w-5 accent-[var(--color-signal)]"
            />
            Prévenir le client par SMS
          </label>
          <div className="flex gap-2">
            <Bouton
              principal
              disabled={pending}
              onClick={() =>
                traiter(
                  formulaire === "REFUS"
                    ? refuserRendezVous(appointmentId, {
                        motif,
                        prevenirClient: prevenir,
                      })
                    : annulerRendezVous(appointmentId, {
                        motif,
                        prevenirClient: prevenir,
                      }),
                )
              }
            >
              Confirmer {formulaire === "REFUS" ? "le refus" : "l’annulation"}
            </Bouton>
            <Bouton disabled={pending} onClick={() => setFormulaire(null)}>
              Retour
            </Bouton>
          </div>
        </div>
      ) : null}

      {formulaire === "PROPOSITION" ? (
        <div className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3">
          <label
            className="text-sm font-medium"
            htmlFor={`horaire-${appointmentId}`}
          >
            Nouvel horaire proposé
          </label>
          <input
            id={`horaire-${appointmentId}`}
            type="datetime-local"
            value={nouvelHoraire}
            onChange={(e) => setNouvelHoraire(e.target.value)}
            className="min-h-12 rounded-control border border-line px-3"
          />
          <p className="text-sm text-ink-soft">
            Le client reçoit un lien pour accepter ou refuser. Le rendez-vous
            n’est confirmé que s’il accepte, et le créneau d’origine reste
            bloqué d’ici là.
          </p>
          <div className="flex gap-2">
            <Bouton
              principal
              disabled={pending || !nouvelHoraire}
              onClick={() =>
                traiter(
                  proposerAutreHoraire(
                    appointmentId,
                    nouvelHoraire,
                    dureeMinutes,
                    {
                      prevenirClient: true,
                    },
                  ),
                )
              }
            >
              Envoyer la proposition
            </Bouton>
            <Bouton disabled={pending} onClick={() => setFormulaire(null)}>
              Retour
            </Bouton>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Bouton({
  children,
  onClick,
  disabled,
  principal = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  principal?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-11 rounded-control border px-3 text-sm font-medium disabled:opacity-60",
        principal
          ? "border-signal bg-signal-soft text-signal-deep"
          : "border-line bg-surface text-ink-soft",
      )}
    >
      {children}
    </button>
  );
}
