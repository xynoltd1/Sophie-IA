"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  MODES,
  instructionsRenvoi,
  type ModeConnexion,
} from "@/lib/sophie/renvoi";
import {
  basculerLigne,
  enregistrerLigne,
  retirerLigne,
  type LigneState,
} from "./actions";

export interface LignePhone {
  id: string;
  e164: string;
  public_number: string | null;
  label: string | null;
  connection_mode: ModeConnexion;
  is_test: boolean;
  is_active: boolean;
  provider: string;
  last_error: string | null;
  verified_at: string | null;
}

export function LigneEditor({
  lignes,
  pays,
  peutGerer,
  fournisseurConfigure,
}: {
  lignes: LignePhone[];
  pays: string;
  peutGerer: boolean;
  fournisseurConfigure: boolean;
}) {
  const [state, action, enCours] = useActionState<LigneState, FormData>(
    enregistrerLigne,
    {},
  );
  const [pending, demarrer] = useTransition();
  const [ouvert, setOuvert] = useState(lignes.length === 0);
  const [mode, setMode] = useState<ModeConnexion>("FORWARD");
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      {lignes.map((ligne) => (
        <section key={ligne.id} className="flex flex-col gap-2">
          <Sheet
            tone={
              ligne.last_error
                ? "urgent"
                : ligne.is_active
                  ? "neutral"
                  : "attention"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold tabular">
                  {ligne.e164}
                </p>
                <p className="text-sm text-ink-soft">
                  {ligne.label ? `${ligne.label} · ` : ""}
                  {MODES.find((m) => m.cle === ligne.connection_mode)?.libelle}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {ligne.is_test ? <Badge ton="discret">essai</Badge> : null}
                <Badge ton={ligne.is_active ? "signal" : "attention"}>
                  {ligne.is_active ? "Active" : "Désactivée"}
                </Badge>
              </div>
            </div>

            <dl className="mt-3 flex flex-col gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-ink-soft">Fournisseur</dt>
                <dd>{ligne.provider}</dd>
              </div>
              {ligne.public_number ? (
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-ink-soft">
                    Numéro de vos clients
                  </dt>
                  <dd className="tabular">{ligne.public_number}</dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="w-40 shrink-0 text-ink-soft">
                  Premier appel reçu
                </dt>
                <dd>
                  {ligne.verified_at
                    ? new Date(ligne.verified_at).toLocaleDateString("fr-BE")
                    : "aucun appel reçu sur cette ligne"}
                </dd>
              </div>
            </dl>

            {ligne.last_error ? (
              <p className="mt-2 text-sm text-urgent">
                Dernière erreur : {ligne.last_error}
              </p>
            ) : null}

            {peutGerer ? (
              <div className="mt-3 flex flex-wrap gap-4">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    demarrer(async () => {
                      await basculerLigne(ligne.id, !ligne.is_active);
                      router.refresh();
                    })
                  }
                  className="text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                >
                  {ligne.is_active ? "Désactiver" : "Réactiver"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    demarrer(async () => {
                      await retirerLigne(ligne.id);
                      router.refresh();
                    })
                  }
                  className="text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                >
                  Retirer
                </button>
              </div>
            ) : null}
          </Sheet>

          {ligne.connection_mode === "FORWARD" && ligne.is_active ? (
            <Sheet tone="neutral">
              <p className="font-medium">Renvoyer vos appels vers Sophie</p>
              <p className="mt-1 text-sm text-ink-soft">
                Composez l’un de ces codes depuis votre téléphone, comme un
                numéro. Le deuxième est celui que nous conseillons pour
                commencer.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {instructionsRenvoi(ligne.e164, pays).map((instruction) => (
                  <li key={instruction.code}>
                    <p className="text-sm font-medium">{instruction.titre}</p>
                    <p className="mt-0.5 select-all font-mono text-base tabular">
                      {instruction.code}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">
                      {instruction.explication}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-ink-soft">
                Ces codes sont ceux du réseau mobile. Si votre opérateur les
                refuse, demandez-lui « le renvoi d’appel sur non-réponse ».
              </p>
            </Sheet>
          ) : null}
        </section>
      ))}

      {!fournisseurConfigure ? (
        <Sheet tone="attention">
          <p className="font-medium">
            Aucun fournisseur de téléphonie n’est configuré
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Vous pouvez déclarer un numéro ici, mais aucun appel n’arrivera tant
            que la clé du fournisseur n’est pas renseignée sur le serveur.
            Déclarer une ligne ne la commande pas et ne l’active pas.
          </p>
        </Sheet>
      ) : null}

      {peutGerer ? (
        !ouvert ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOuvert(true)}
          >
            Déclarer une autre ligne
          </Button>
        ) : (
          <form action={action}>
            <Sheet className="flex flex-col gap-3">
              <p className="font-medium">Déclarer une ligne</p>
              <p className="text-sm text-ink-soft">
                Le numéro sur lequel Sophie reçoit les appels. C’est celui que
                votre fournisseur de téléphonie vous a attribué, écrit en entier
                avec l’indicatif.
              </p>

              <Champ
                nom="numero"
                libelle="Numéro de réception"
                requis
                placeholder="+32 2 123 45 67"
              />

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  Comment vos clients vous joignent
                </span>
                {MODES.map((m) => (
                  <label key={m.cle} className="flex items-start gap-2 py-1">
                    <input
                      type="radio"
                      name="mode"
                      value={m.cle}
                      checked={mode === m.cle}
                      onChange={() => setMode(m.cle)}
                      className="mt-1 h-5 w-5 accent-[var(--color-signal)]"
                    />
                    <span className="text-sm">
                      <span className="font-medium">{m.libelle}</span>
                      <span className="block text-ink-soft">{m.detail}</span>
                    </span>
                  </label>
                ))}
              </div>

              {mode !== "DIRECT" ? (
                <Champ
                  nom="numeroPublic"
                  libelle="Votre numéro habituel (celui que connaissent vos clients)"
                  placeholder="+32 475 12 34 56"
                />
              ) : null}

              <Champ
                nom="label"
                libelle="Nom de la ligne (facultatif)"
                placeholder="Ligne principale"
              />

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  name="essai"
                  className="mt-1 h-5 w-5 accent-[var(--color-signal)]"
                />
                <span className="text-sm">
                  Ligne d’essai
                  <span className="block text-ink-soft">
                    Les appels reçus seront marqués « essai » et ne compteront
                    dans aucune statistique. À ne jamais communiquer à un vrai
                    client.
                  </span>
                </span>
              </label>

              {state.error ? (
                <p className="text-sm text-urgent">{state.error}</p>
              ) : null}
              {state.success ? (
                <p className="text-sm text-signal-deep">{state.success}</p>
              ) : null}

              <div className="flex gap-2">
                <Button type="submit" loading={enCours}>
                  Enregistrer la ligne
                </Button>
                {lignes.length > 0 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setOuvert(false)}
                  >
                    Annuler
                  </Button>
                ) : null}
              </div>
            </Sheet>
          </form>
        )
      ) : null}
    </div>
  );
}

function Champ({
  nom,
  libelle,
  requis = false,
  placeholder,
}: {
  nom: string;
  libelle: string;
  requis?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium" htmlFor={nom}>
        {libelle}
      </label>
      <input
        id={nom}
        name={nom}
        required={requis}
        placeholder={placeholder}
        className="min-h-12 rounded-control border border-line px-3"
      />
    </div>
  );
}
