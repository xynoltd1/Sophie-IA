"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  basculerPublication,
  enregistrerMetier,
  type MetierState,
} from "./actions";

export interface LigneMetier {
  slug: string;
  label: string;
  is_published: boolean;
  services: number;
  default_appointment_minutes: number;
}

export function MetiersEditor({ metiers }: { metiers: LigneMetier[] }) {
  const [state, action, enCours] = useActionState<MetierState, FormData>(
    enregistrerMetier,
    {},
  );
  const [pending, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-2">
        {metiers.map((metier) => (
          <li key={metier.slug}>
            <Sheet className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{metier.label}</p>
                <p className="text-sm text-ink-soft">
                  {metier.slug} · {metier.services} service
                  {metier.services > 1 ? "s" : ""} ·{" "}
                  {metier.default_appointment_minutes} min par défaut
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  demarrer(async () => {
                    await basculerPublication(
                      metier.slug,
                      !metier.is_published,
                    );
                    router.refresh();
                  })
                }
                className="shrink-0 text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
              >
                {metier.is_published
                  ? "Publié — retirer"
                  : "Non publié — publier"}
              </button>
            </Sheet>
          </li>
        ))}
      </ul>

      {!ouvert ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOuvert(true)}
        >
          Ajouter ou modifier un métier
        </Button>
      ) : (
        <form action={action}>
          <Sheet className="flex flex-col gap-3">
            <p className="font-medium">Métier</p>
            <p className="text-sm text-ink-soft">
              Un identifiant déjà existant met le métier à jour. Les entreprises
              déjà inscrites ne sont pas modifiées : le modèle sert au moment de
              l’inscription.
            </p>

            <Champ nom="slug" libelle="Identifiant (ex. vitrier)" requis />
            <Champ nom="label" libelle="Nom affiché (ex. Vitrier)" requis />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="services">
                Services suggérés — une ligne par service
              </label>
              <textarea
                id="services"
                name="services"
                rows={5}
                required
                placeholder={
                  "Remplacement de vitre | 90\nDépannage urgent | 60 | urgent"
                }
                className="rounded-control border border-line p-3 font-mono text-sm"
              />
              <p className="text-sm text-ink-soft">
                Format : nom | durée en minutes | « urgent » si l’intervention
                est urgente.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="questions">
                Questions de qualification — une par ligne
              </label>
              <textarea
                id="questions"
                name="questions"
                rows={3}
                placeholder={
                  "La vitre est-elle brisée ou fissurée ?\nQuelle est la taille approximative ?"
                }
                className="rounded-control border border-line p-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium" htmlFor="urgences">
                Situations urgentes — une par ligne
              </label>
              <textarea
                id="urgences"
                name="urgences"
                rows={3}
                placeholder={"Vitrine cassée sur rue\nEffraction"}
                className="rounded-control border border-line p-3 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Champ
                nom="defaultAppointmentMinutes"
                libelle="Durée par défaut (min)"
                type="number"
                defaut="60"
              />
              <Champ
                nom="defaultBufferMinutes"
                libelle="Marge (min)"
                type="number"
                defaut="15"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isPublished"
                defaultChecked
                className="h-5 w-5 accent-[var(--color-signal)]"
              />
              Publier : le métier apparaît dans l’inscription
            </label>

            {state.error ? (
              <p className="text-sm text-urgent">{state.error}</p>
            ) : null}
            {state.success ? (
              <p className="text-sm text-signal-deep">{state.success}</p>
            ) : null}

            <div className="flex gap-2">
              <Button type="submit" loading={enCours}>
                Enregistrer
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOuvert(false)}
              >
                Fermer
              </Button>
            </div>
          </Sheet>
        </form>
      )}
    </div>
  );
}

function Champ({
  nom,
  libelle,
  type = "text",
  requis = false,
  defaut,
}: {
  nom: string;
  libelle: string;
  type?: string;
  requis?: boolean;
  defaut?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={nom}>
        {libelle}
      </label>
      <input
        id={nom}
        name={nom}
        type={type}
        required={requis}
        defaultValue={defaut}
        className="min-h-12 rounded-control border border-line px-3"
      />
    </div>
  );
}
