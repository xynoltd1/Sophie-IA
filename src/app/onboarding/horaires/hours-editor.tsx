"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import { WEEKDAYS, type HourInput } from "@/lib/org/schedule";
import { saveHours, type HoursState } from "./actions";

export function HoursEditor({
  initialHours,
  defaultAppointmentMinutes,
  bufferMinutes,
}: {
  initialHours: HourInput[];
  defaultAppointmentMinutes: number;
  bufferMinutes: number;
}) {
  const [hours, setHours] = useState(initialHours);
  const [duration, setDuration] = useState(defaultAppointmentMinutes);
  const [buffer, setBuffer] = useState(bufferMinutes);
  const [state, setState] = useState<HoursState>({});
  const [pending, startTransition] = useTransition();

  function update(weekday: number, patch: Partial<HourInput>) {
    setHours((current) =>
      current.map((hour) => (hour.weekday === weekday ? { ...hour, ...patch } : hour)),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {hours.map((hour) => {
          const day = WEEKDAYS.find((d) => d.value === hour.weekday);
          const dayError = state.dayErrors?.[hour.weekday];

          return (
            <li key={hour.weekday}>
              <Sheet className={cn("flex flex-col gap-3", dayError && "border-urgent")}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{day?.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hour.is_open}
                    aria-label={`${day?.label} : ${hour.is_open ? "ouvert" : "fermé"}`}
                    onClick={() => update(hour.weekday, { is_open: !hour.is_open })}
                    className={cn(
                      "relative h-8 w-14 shrink-0 rounded-full transition-colors",
                      hour.is_open ? "bg-signal" : "bg-line",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1 h-6 w-6 rounded-full bg-surface transition-all",
                        hour.is_open ? "left-7" : "left-1",
                      )}
                    />
                  </button>
                </div>

                {hour.is_open ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={hour.opens_at}
                      onChange={(e) => update(hour.weekday, { opens_at: e.target.value })}
                      aria-label={`Ouverture ${day?.label}`}
                      className="min-h-12 flex-1 rounded-control border border-line bg-surface px-3 text-base tabular"
                    />
                    <span aria-hidden className="text-ink-soft">
                      à
                    </span>
                    <input
                      type="time"
                      value={hour.closes_at}
                      onChange={(e) => update(hour.weekday, { closes_at: e.target.value })}
                      aria-label={`Fermeture ${day?.label}`}
                      className="min-h-12 flex-1 rounded-control border border-line bg-surface px-3 text-base tabular"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-ink-soft">Fermé</p>
                )}

                {dayError ? (
                  <p role="alert" className="text-sm font-medium text-urgent">
                    {dayError}
                  </p>
                ) : null}
              </Sheet>
            </li>
          );
        })}
      </ul>

      <Sheet className="flex flex-col gap-4">
        <Field
          label="Durée standard d'un rendez-vous"
          htmlFor="duration"
          hint="En minutes. Chaque service peut avoir sa propre durée."
        >
          <Input
            id="duration"
            type="number"
            min={5}
            max={1440}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </Field>

        <Field
          label="Marge entre deux interventions"
          htmlFor="buffer"
          hint="Le temps de trajet et de rangement. Sophie en tiendra compte."
        >
          <Input
            id="buffer"
            type="number"
            min={0}
            max={240}
            step={5}
            value={buffer}
            onChange={(e) => setBuffer(Number(e.target.value))}
          />
        </Field>
      </Sheet>

      <Button
        type="button"
        size="lg"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await saveHours({
              hours,
              defaultAppointmentMinutes: duration,
              bufferMinutes: buffer,
            });
            if (result) setState(result);
          })
        }
      >
        Continuer
      </Button>
    </div>
  );
}
