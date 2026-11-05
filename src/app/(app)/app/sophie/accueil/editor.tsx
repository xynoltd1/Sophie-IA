"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import {
  composerAccueil,
  LONGUEUR_MAX,
  MODELE_PAR_DEFAUT,
  premierMessage,
  VARIABLES,
  verifierModele,
  type Moment,
} from "@/lib/sophie/greeting";
import { enregistrerAccueil, type AccueilState } from "./actions";

const MOMENTS: { cle: Moment; libelle: string }[] = [
  { cle: "MATIN", libelle: "Le matin" },
  { cle: "APRES_MIDI", libelle: "L’après-midi" },
  { cle: "SOIR", libelle: "Le soir" },
];

export interface AccueilInitial {
  assistantName: string;
  spokenName: string;
  organizationName: string;
  metier: string | null;
  greeting: string;
  greetingMorning: string;
  greetingEvening: string;
  greetingClosed: string;
  noticePosition: "APRES_ACCUEIL" | "AVANT_ACCUEIL";
  /** L'annonce d'enregistrement réellement due, ou null. */
  annonce: string | null;
  modifiable: boolean;
}

function Zone({
  id,
  name,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      id={id}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={3}
      maxLength={LONGUEUR_MAX}
      placeholder={placeholder}
      className="w-full rounded-control border border-line bg-surface px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-signal"
    />
  );
}

/**
 * L'accueil, avec ce qui sera réellement dit.
 *
 * L'aperçu n'est pas une illustration : il appelle `composerAccueil`, la même
 * fonction que le serveur au moment où le téléphone sonne. Un aperçu qui
 * recomposerait la phrase de son côté finirait par montrer autre chose que ce
 * qui est prononcé — c'est précisément le piège demandé à éviter.
 */
export function EditeurAccueil({ initial }: { initial: AccueilInitial }) {
  const [state, action, pending] = useActionState<AccueilState, FormData>(
    enregistrerAccueil,
    {},
  );

  const [assistante, setAssistante] = useState(initial.assistantName);
  const [nomPrononce, setNomPrononce] = useState(initial.spokenName);
  const [base, setBase] = useState(initial.greeting);
  const [matin, setMatin] = useState(initial.greetingMorning);
  const [soir, setSoir] = useState(initial.greetingEvening);
  const [ferme, setFerme] = useState(initial.greetingClosed);
  const [position, setPosition] = useState(initial.noticePosition);
  const [apercu, setApercu] = useState<Moment>("MATIN");

  const entreprise =
    nomPrononce.trim() || initial.organizationName || "Votre entreprise";

  const modeleActif =
    apercu === "MATIN" && matin.trim()
      ? matin
      : apercu === "SOIR" && soir.trim()
        ? soir
        : base;

  const phrase = useMemo(
    () =>
      premierMessage({
        accueil: composerAccueil({
          modele: modeleActif,
          entreprise,
          assistante: assistante.trim() || "Sophie",
          metier: initial.metier,
          moment: apercu,
        }),
        annonce: initial.annonce,
        position,
      }),
    [
      modeleActif,
      entreprise,
      assistante,
      apercu,
      position,
      initial.metier,
      initial.annonce,
    ],
  );

  const problemes = [
    ...verifierModele(base, "la formule principale"),
    ...verifierModele(matin, "la formule du matin"),
    ...verifierModele(soir, "la formule du soir"),
    ...verifierModele(ferme, "la formule hors horaires"),
  ];

  return (
    <form action={action} className="flex flex-col gap-5">
      <Sheet tone="neutral">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">Ce que le client entendra</p>
          <div className="flex gap-1.5">
            {MOMENTS.map((m) => (
              <button
                key={m.cle}
                type="button"
                onClick={() => setApercu(m.cle)}
                className={`min-h-11 rounded-control px-3 text-sm ${
                  apercu === m.cle
                    ? "bg-signal text-white"
                    : "bg-paper text-ink-soft"
                }`}
              >
                {m.libelle}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-lg leading-relaxed">« {phrase} »</p>

        <p className="mt-2 text-sm text-ink-faint">
          {phrase.length} caractères, soit environ{" "}
          {Math.max(1, Math.round(phrase.split(/\s+/).length / 2.5))} secondes à
          voix haute.
        </p>
      </Sheet>

      <Field label="Nom de l’assistante" htmlFor="assistant_name">
        <Input
          id="assistant_name"
          name="assistant_name"
          value={assistante}
          onChange={(e) => setAssistante(e.target.value)}
          required
          minLength={2}
          maxLength={40}
          disabled={!initial.modifiable}
        />
      </Field>

      <div>
        <Field
          label="Nom de l’entreprise tel qu’il se prononce"
          htmlFor="spoken_name"
          hint={`Vide : « ${initial.organizationName} » sera dit.`}
        >
          <Input
            id="spoken_name"
            name="spoken_name"
            value={nomPrononce}
            onChange={(e) => setNomPrononce(e.target.value)}
            maxLength={60}
            placeholder={initial.organizationName}
            disabled={!initial.modifiable}
          />
        </Field>
        <p className="mt-1 text-sm text-ink-soft">
          Au téléphone on ne dit pas « SRL » ni « SPRL ». Mettez ici le nom que
          vous donnez vous-même quand vous décrochez.
        </p>
      </div>

      <div>
        <Field label="Formule d’accueil" htmlFor="greeting">
          <Zone
            id="greeting"
            name="greeting"
            value={base}
            onChange={setBase}
            placeholder={MODELE_PAR_DEFAUT}
          />
        </Field>
        <p className="mt-1 text-sm text-ink-soft">
          Vide : la formule par défaut sert. Variables disponibles —{" "}
          {VARIABLES.map((v) => `{${v.cle}}`).join(", ")}.
        </p>
      </div>

      <details className="rounded-control border border-line p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Formules différentes selon le moment
        </summary>

        <div className="mt-3 flex flex-col gap-4">
          <Field label="Le matin" htmlFor="greeting_morning">
            <Zone
              id="greeting_morning"
              name="greeting_morning"
              value={matin}
              onChange={setMatin}
              placeholder="Vide : la formule d’accueil sert aussi le matin."
            />
          </Field>

          <Field label="Le soir, après 18 h" htmlFor="greeting_evening">
            <Zone
              id="greeting_evening"
              name="greeting_evening"
              value={soir}
              onChange={setSoir}
              placeholder="Vide : la formule d’accueil sert aussi le soir."
            />
          </Field>

          <Field label="En dehors de vos horaires" htmlFor="greeting_closed">
            <Zone
              id="greeting_closed"
              name="greeting_closed"
              value={ferme}
              onChange={setFerme}
              placeholder="Vide : la formule d’accueil sert aussi quand c’est fermé."
            />
          </Field>
        </div>
      </details>

      <div>
        <Field label="Annonce d’enregistrement" htmlFor="notice_position">
          <select
            id="notice_position"
            name="notice_position"
            value={position}
            onChange={(e) =>
              setPosition(e.target.value as AccueilInitial["noticePosition"])
            }
            disabled={!initial.modifiable}
            className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
          >
            <option value="APRES_ACCUEIL">Après l’accueil</option>
            <option value="AVANT_ACCUEIL">Avant l’accueil</option>
          </select>
        </Field>
        <p className="mt-1 text-sm text-ink-soft">
          {initial.annonce
            ? "Elle est due parce que vos appels sont enregistrés. Vous choisissez où elle tombe, pas si elle est dite."
            : "Aucune annonce d’enregistrement n’est due : vos appels ne sont pas enregistrés. Ce réglage servira le jour où ils le seront."}
        </p>
      </div>

      {problemes.length > 0 ? (
        <p className="rounded-control bg-attention-soft px-3 py-2.5 text-sm leading-relaxed">
          {problemes.map((p) => `${p.champ} : ${p.message}`).join(" ")}
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-control bg-urgent-soft px-3 py-2.5 text-sm"
        >
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-control bg-signal-soft px-3 py-2.5 text-sm leading-relaxed">
          {state.success}
        </p>
      ) : null}

      {initial.modifiable ? (
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l’accueil"}
        </Button>
      ) : (
        <p className="text-sm text-ink-soft">
          Votre rôle ne permet pas de modifier l’accueil.
        </p>
      )}
    </form>
  );
}
