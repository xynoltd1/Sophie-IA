"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils/cn";
import { formatTime } from "@/lib/crm/agenda";
import { bookAppointment, type AgendaState } from "./actions";
import { fetchSlots } from "./slots";

export function BookingPanel({
  defaultDay,
}: {
  defaultDay: string;
  organizationId: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [jour, setJour] = useState(defaultDay);
  const [duree, setDuree] = useState(60);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotChoisi, setSlotChoisi] = useState<string | null>(null);
  const [erreurSlots, setErreurSlots] = useState<string | null>(null);
  const [chargement, startTransition] = useTransition();
  const [state, action, pending] = useActionState<AgendaState, FormData>(bookAppointment, {});
  const router = useRouter();

  useEffect(() => {
    if (!ouvert) return;
    startTransition(async () => {
      setErreurSlots(null);
      setSlotChoisi(null);
      const resultat = await fetchSlots(jour, duree);
      if (resultat.error) setErreurSlots(resultat.error);
      setSlots(resultat.slots);
    });
  }, [ouvert, jour, duree]);

  useEffect(() => {
    if (state.success) {
      setOuvert(false);
      router.refresh();
    }
  }, [state.success, router]);

  if (!ouvert) {
    return (
      <Button type="button" size="lg" onClick={() => setOuvert(true)}>
        Réserver un créneau
      </Button>
    );
  }

  return (
    <Sheet>
      <form action={action} className="flex flex-col gap-4">
        {state.error ? (
          <p role="alert" className="rounded-control bg-urgent-soft px-4 py-3 text-sm text-ink">
            {state.error}
          </p>
        ) : null}

        <Field label="Intitulé" htmlFor="title">
          <Input id="title" name="title" required placeholder="Dépannage chaudière" />
        </Field>

        <div className="flex gap-3">
          <div className="flex-1">
            <Field label="Jour" htmlFor="jour">
              <Input
                id="jour"
                type="date"
                value={jour}
                min={defaultDay}
                onChange={(event) => setJour(event.target.value)}
              />
            </Field>
          </div>
          <div className="w-32">
            <Field label="Durée" htmlFor="duree">
              <Input
                id="duree"
                type="number"
                min={15}
                max={480}
                step={15}
                value={duree}
                onChange={(event) => setDuree(Number(event.target.value))}
              />
            </Field>
          </div>
        </div>

        <input type="hidden" name="startsAt" value={slotChoisi ?? ""} />
        <input type="hidden" name="durationMinutes" value={duree} />

        <div>
          <p className="mb-2 text-sm font-medium text-ink">Créneaux libres</p>
          {chargement ? (
            <p className="text-sm text-ink-soft">Calcul en cours…</p>
          ) : erreurSlots ? (
            <p role="alert" className="text-sm font-medium text-urgent">
              {erreurSlots}
            </p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Aucun créneau ce jour-là. Vérifiez vos horaires d’ouverture ou choisissez un
              autre jour.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {slots.map((slot) => (
                <li key={slot}>
                  <button
                    type="button"
                    onClick={() => setSlotChoisi(slot)}
                    aria-pressed={slotChoisi === slot}
                    className={cn(
                      "min-h-11 rounded-control border px-3 text-sm tabular",
                      slotChoisi === slot
                        ? "border-signal bg-signal-soft font-medium text-signal-deep"
                        : "border-line bg-surface text-ink",
                    )}
                  >
                    {formatTime(slot)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" loading={pending} disabled={!slotChoisi}>
            Réserver
          </Button>
          <Button type="button" variant="quiet" onClick={() => setOuvert(false)}>
            Annuler
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
