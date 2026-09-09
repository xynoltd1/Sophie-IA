"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { APPOINTMENT_STATUS_LABELS, appointmentActions } from "@/lib/crm/agenda";
import { changeAppointmentStatus } from "./actions";
import type { AppointmentStatus } from "@/types/database";
import { cn } from "@/lib/utils/cn";

export function AppointmentActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const actions = appointmentActions(status);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm font-medium text-urgent">
          {error}
        </p>
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
                else router.refresh();
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
