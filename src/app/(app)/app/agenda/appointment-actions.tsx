"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { APPOINTMENT_STATUS_LABELS, appointmentActions } from "@/lib/crm/agenda";
import { changeAppointmentStatus, retryCalendarSync } from "./actions";
import type { AppointmentStatus } from "@/types/database";
import { cn } from "@/lib/utils/cn";

export function AppointmentActions({
  appointmentId,
  status,
  syncError = false,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  syncError?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const router = useRouter();
  const actions = appointmentActions(status);

  if (actions.length === 0 && !syncError) return null;

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm font-medium text-urgent">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p role="status" className="text-sm text-attention">
          {warning}
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
      <div className="flex flex-wrap gap-2">
        {actions.map((cible) => (
          <button
            key={cible}
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const resultat = await changeAppointmentStatus(appointmentId, cible);
                if (resultat?.error) setError(resultat.error);
                else {
                  if (resultat?.warning) setWarning(resultat.warning);
                  router.refresh();
                }
              })
            }
            className={cn(
              "min-h-11 rounded-control border px-3 text-sm font-medium disabled:opacity-60",
              cible === "CONFIRMED"
                ? "border-signal bg-signal-soft text-signal-deep"
                : "border-line bg-surface text-ink-soft",
            )}
          >
            {APPOINTMENT_STATUS_LABELS[cible]}
          </button>
        ))}
      </div>
    </div>
  );
}
