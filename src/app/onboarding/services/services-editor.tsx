"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import type { ServiceRow } from "@/types/database";
import {
  addService,
  continueToSchedule,
  toggleService,
  updateDuration,
  type ServicesState,
} from "./actions";

export function ServicesEditor({ services }: { services: ServiceRow[] }) {
  const [state, action, adding] = useActionState<ServicesState, FormData>(addService, {});
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();
  const [continueError, setContinueError] = useState<string | null>(null);

  const activeCount = services.filter((service) => service.is_active).length;

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2">
        {services.map((service) => (
          <li key={service.id}>
            <Sheet
              className={cn(
                "flex flex-col gap-3",
                !service.is_active && "border-dashed opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{service.name}</p>
                  {service.is_urgent ? (
                    <p className="mt-0.5 text-sm text-urgent">Traité comme une urgence</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={service.is_active}
                  aria-label={`${service.is_active ? "Désactiver" : "Activer"} ${service.name}`}
                  onClick={() =>
                    startTransition(() => toggleService(service.id, !service.is_active))
                  }
                  className={cn(
                    "relative h-8 w-14 shrink-0 rounded-full transition-colors",
                    service.is_active ? "bg-signal" : "bg-line",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-1 h-6 w-6 rounded-full bg-surface transition-all",
                      service.is_active ? "left-7" : "left-1",
                    )}
                  />
                </button>
              </div>

              {service.is_active ? (
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  Durée
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    step={5}
                    defaultValue={service.duration_minutes}
                    onBlur={(event) =>
                      startTransition(() =>
                        updateDuration(service.id, Number(event.target.value)),
                      )
                    }
                    className="min-h-11 w-24 rounded-control border border-line bg-surface px-3 text-base text-ink tabular"
                    aria-label={`Durée de ${service.name} en minutes`}
                  />
                  minutes
                </label>
              ) : null}
            </Sheet>
          </li>
        ))}
      </ul>

      {showForm ? (
        <Sheet>
          <form action={action} className="flex flex-col gap-4">
            {state.error ? (
              <p role="alert" className="text-sm font-medium text-urgent">
                {state.error}
              </p>
            ) : null}

            <Field label="Nom du service" htmlFor="name">
              <Input id="name" name="name" required placeholder="Détartrage de chaudière" />
            </Field>

            <Field label="Durée en minutes" htmlFor="durationMinutes">
              <Input
                id="durationMinutes"
                name="durationMinutes"
                type="number"
                min={5}
                max={1440}
                step={5}
                defaultValue={60}
                required
              />
            </Field>

            <Field
              label="Indication de prix"
              htmlFor="priceIndication"
              hint="Facultatif, en toutes lettres. Sophie répétera ce texte sans jamais calculer un prix."
            >
              <Input
                id="priceIndication"
                name="priceIndication"
                placeholder="À partir de 80 € — sur devis"
              />
            </Field>

            <label className="flex min-h-12 items-center gap-3 text-base">
              <input type="checkbox" name="isUrgent" className="h-5 w-5 accent-[var(--color-signal)]" />
              Traiter ce service comme une urgence
            </label>

            <div className="flex gap-2">
              <Button type="submit" loading={adding}>
                Ajouter
              </Button>
              <Button type="button" variant="quiet" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Sheet>
      ) : (
        <Button type="button" variant="secondary" onClick={() => setShowForm(true)}>
          Ajouter un service
        </Button>
      )}

      {state.success ? (
        <p role="status" className="text-sm text-signal-deep">
          {state.success}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        {continueError ? (
          <p role="alert" className="text-sm font-medium text-urgent">
            {continueError}
          </p>
        ) : null}
        <p className="text-sm text-ink-soft">
          {activeCount} service{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}.
        </p>
        <Button
          type="button"
          size="lg"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await continueToSchedule();
              if (result?.error) setContinueError(result.error);
            })
          }
        >
          Continuer
        </Button>
      </div>
    </div>
  );
}
