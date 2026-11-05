"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  changerRole,
  desactiverMembre,
  inviterMembre,
  revoquerInvitation,
  type EquipeState,
} from "./actions";
import type { MemberRole } from "@/types/database";

export interface LigneMembre {
  user_id: string;
  role: MemberRole;
  status: string;
  nom: string | null;
}

export interface LigneInvitation {
  id: string;
  email: string;
  role: MemberRole;
  expires_at: string;
}

const ROLES: Record<MemberRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MEMBER: "Membre",
};

export function EquipeEditor({
  membres,
  invitations,
  peutGerer,
}: {
  membres: LigneMembre[];
  invitations: LigneInvitation[];
  peutGerer: boolean;
}) {
  const [state, action, enCours] = useActionState<EquipeState, FormData>(
    inviterMembre,
    {},
  );
  const [pending, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      {erreur ? <p className="text-sm text-urgent">{erreur}</p> : null}

      <ul className="flex flex-col gap-2">
        {membres.map((membre) => (
          <li key={membre.user_id}>
            <Sheet
              className={
                membre.status === "SUSPENDED" ? "opacity-60" : undefined
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {membre.nom ?? "Membre sans nom"}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {ROLES[membre.role]}
                    {membre.status === "SUSPENDED" ? " · retiré" : ""}
                  </p>
                </div>

                {peutGerer &&
                membre.role !== "OWNER" &&
                membre.status !== "SUSPENDED" ? (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <select
                      value={membre.role}
                      disabled={pending}
                      onChange={(e) =>
                        demarrer(async () => {
                          setErreur(null);
                          const r = await changerRole(
                            membre.user_id,
                            e.target.value as MemberRole,
                          );
                          if (!r.ok)
                            setErreur(r.erreur ?? "Changement refusé.");
                          router.refresh();
                        })
                      }
                      className="min-h-11 rounded-control border border-line bg-surface px-2 text-sm"
                    >
                      <option value="ADMIN">Administrateur</option>
                      <option value="MEMBER">Membre</option>
                    </select>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        demarrer(async () => {
                          setErreur(null);
                          const r = await desactiverMembre(membre.user_id);
                          if (!r.ok) setErreur(r.erreur ?? "Retrait refusé.");
                          router.refresh();
                        })
                      }
                      className="text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                    >
                      Retirer
                    </button>
                  </div>
                ) : null}
              </div>
            </Sheet>
          </li>
        ))}
      </ul>

      {invitations.length > 0 ? (
        <section>
          <p className="mb-2 font-medium">Invitations en attente</p>
          <ul className="flex flex-col gap-2">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <Sheet
                  tone="attention"
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {invitation.email}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {ROLES[invitation.role]}
                    </p>
                  </div>
                  {peutGerer ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        demarrer(async () => {
                          await revoquerInvitation(invitation.id);
                          router.refresh();
                        })
                      }
                      className="shrink-0 text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                    >
                      Annuler
                    </button>
                  ) : null}
                </Sheet>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {peutGerer ? (
        <form action={action}>
          <Sheet className="flex flex-col gap-3">
            <p className="font-medium">Inviter quelqu’un</p>

            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="email">
                Son adresse e-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="min-h-12 rounded-control border border-line px-3"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="role">
                Son rôle
              </label>
              <select
                id="role"
                name="role"
                defaultValue="MEMBER"
                className="min-h-12 rounded-control border border-line bg-surface px-3"
              >
                <option value="MEMBER">Membre</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>

            {state.error ? (
              <p className="text-sm text-urgent">{state.error}</p>
            ) : null}
            {state.success ? (
              <p className="text-sm text-signal-deep">{state.success}</p>
            ) : null}

            {state.lien ? (
              <div className="rounded-control border border-line bg-paper p-3">
                <p className="text-sm font-medium">Lien d’invitation</p>
                <p className="mt-1 break-all font-mono text-sm">{state.lien}</p>
                <p className="mt-2 text-sm text-ink-soft">
                  Aucun e-mail n’est envoyé : il n’y a pas encore de service
                  d’envoi configuré. Copiez ce lien et transmettez-le vous-même.
                  Il ne sera plus affiché après avoir quitté cette page.
                </p>
              </div>
            ) : null}

            <Button type="submit" loading={enCours}>
              Créer l’invitation
            </Button>
          </Sheet>
        </form>
      ) : null}
    </div>
  );
}
