"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils/cn";
import { createTask, toggleTask, updateContact, type ContactFormState } from "../actions";
import type { ContactRow, TaskRow } from "@/types/database";

type TaskItem = Pick<TaskRow, "id" | "title" | "status" | "due_at"> & { overdue: boolean };

export function ContactPanels({
  contact,
  tasks,
}: {
  contact: ContactRow;
  tasks: TaskItem[];
}) {
  return (
    <>
      <TasksPanel contactId={contact.id} tasks={tasks} />
      <DetailsPanel contact={contact} />
    </>
  );
}

function TasksPanel({ contactId, tasks }: { contactId: string; tasks: TaskItem[] }) {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(createTask, {});
  const [ouvert, setOuvert] = useState(false);
  const [enCours, startTransition] = useTransition();

  return (
    <section>
      <SectionTitle>Tâches</SectionTitle>

      {tasks.length === 0 ? (
        <EmptyState
          title="Aucune tâche"
          description="Un rappel à faire, un devis à envoyer : notez-le ici pour ne pas l’oublier."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <li key={task.id}>
              <Sheet
                tone={task.overdue ? "attention" : "neutral"}
                className="flex items-center gap-3"
              >
                <input
                  type="checkbox"
                  checked={task.status === "DONE"}
                  onChange={(event) =>
                    startTransition(() => toggleTask(task.id, event.target.checked))
                  }
                  disabled={enCours}
                  aria-label={`Marquer « ${task.title} » comme faite`}
                  className="h-6 w-6 shrink-0 accent-[var(--color-signal)]"
                />
                <div className="min-w-0">
                  <p className={cn("font-medium", task.status === "DONE" && "text-ink-faint line-through")}>
                    {task.title}
                  </p>
                  {task.due_at ? (
                    <p className={cn("text-sm", task.overdue ? "text-attention" : "text-ink-soft")}>
                      {new Date(task.due_at).toLocaleDateString("fr-BE", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                      {task.overdue ? " — en retard" : ""}
                    </p>
                  ) : null}
                </div>
              </Sheet>
            </li>
          ))}
        </ul>
      )}

      {ouvert ? (
        <Sheet className="mt-2">
          <form action={action} className="flex flex-col gap-4">
            <input type="hidden" name="contactId" value={contactId} />
            {state.error ? (
              <p role="alert" className="text-sm font-medium text-urgent">
                {state.error}
              </p>
            ) : null}
            <Field label="À faire" htmlFor="task-title">
              <Input id="task-title" name="title" required placeholder="Rappeler pour le devis" />
            </Field>
            <Field label="Pour quand" htmlFor="task-due" hint="Facultatif.">
              <Input id="task-due" name="dueAt" type="date" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={pending}>
                Ajouter
              </Button>
              <Button type="button" variant="quiet" onClick={() => setOuvert(false)}>
                Annuler
              </Button>
            </div>
          </form>
        </Sheet>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => setOuvert(true)}
        >
          Ajouter une tâche
        </Button>
      )}

      {state.success ? (
        <p role="status" className="mt-2 text-sm text-signal-deep">
          {state.success}
        </p>
      ) : null}
    </section>
  );
}

function DetailsPanel({ contact }: { contact: ContactRow }) {
  const [state, action, pending] = useActionState<ContactFormState, FormData>(updateContact, {});
  const [edition, setEdition] = useState(false);

  if (!edition) {
    return (
      <section>
        <SectionTitle>Coordonnées</SectionTitle>
        <Sheet className="flex flex-col gap-1 text-ink">
          {contact.company_name ? <p>{contact.company_name}</p> : null}
          {contact.email ? <p className="text-ink-soft">{contact.email}</p> : null}
          {contact.address_line1 || contact.city ? (
            <p className="text-ink-soft">
              {[contact.address_line1, contact.postal_code, contact.city]
                .filter(Boolean)
                .join(", ")}
            </p>
          ) : null}
          {contact.notes ? (
            <p className="mt-2 whitespace-pre-wrap text-ink-soft">{contact.notes}</p>
          ) : null}
          {!contact.company_name && !contact.email && !contact.city && !contact.notes ? (
            <p className="text-ink-faint">Aucune coordonnée enregistrée.</p>
          ) : null}
        </Sheet>
        <Button
          type="button"
          variant="secondary"
          className="mt-2"
          onClick={() => setEdition(true)}
        >
          Modifier
        </Button>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>Coordonnées</SectionTitle>
      <Sheet>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="contactId" value={contact.id} />
          {state.error ? (
            <p role="alert" className="text-sm font-medium text-urgent">
              {state.error}
            </p>
          ) : null}

          <Field label="Nom" htmlFor="fullName">
            <Input id="fullName" name="fullName" defaultValue={contact.full_name ?? ""} />
          </Field>
          <Field label="Entreprise" htmlFor="companyName">
            <Input id="companyName" name="companyName" defaultValue={contact.company_name ?? ""} />
          </Field>
          <Field label="Téléphone" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} />
          </Field>
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={contact.email ?? ""} />
          </Field>
          <Field label="Adresse" htmlFor="addressLine1">
            <Input id="addressLine1" name="addressLine1" defaultValue={contact.address_line1 ?? ""} />
          </Field>
          <Field label="Ville" htmlFor="city">
            <Input id="city" name="city" defaultValue={contact.city ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={contact.notes ?? ""}
              className="w-full rounded-control border border-line bg-surface px-3.5 py-3 text-base text-ink"
            />
          </Field>

          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Enregistrer
            </Button>
            <Button type="button" variant="quiet" onClick={() => setEdition(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </Sheet>
    </section>
  );
}
