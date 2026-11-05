"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import type { FournisseurConfig } from "@/lib/config/catalogue";
import type { EtatSecret } from "@/lib/config/platform";
import {
  effacerSecret,
  enregistrerFournisseur,
  lancerTest,
  type IntegrationState,
} from "./actions";

/**
 * Formulaire d'un fournisseur.
 *
 * Les champs secrets sont toujours vides à l'affichage : une clé enregistrée
 * ne se réaffiche jamais, même masquée. À la place, l'empreinte et les quatre
 * derniers caractères — assez pour reconnaître la bonne clé dans le tableau de
 * bord du fournisseur, inutile pour s'en servir.
 *
 * Laisser un champ secret vide conserve la valeur existante. C'est le seul
 * comportement qui permette de modifier un réglage voisin sans ressaisir une
 * clé qu'on n'a plus sous la main.
 */
export function ProviderForm({
  config,
  secrets,
  valeurs,
}: {
  config: FournisseurConfig;
  secrets: EtatSecret[];
  valeurs: Record<string, string>;
}) {
  const [etat, enregistrer, enCours] = useActionState<
    IntegrationState,
    FormData
  >(enregistrerFournisseur, {});
  const [etatTest, tester, testEnCours] = useActionState<
    IntegrationState,
    FormData
  >(lancerTest, {});
  const [etatRetrait, retirer, retraitEnCours] = useActionState<
    IntegrationState,
    FormData
  >(effacerSecret, {});

  const enregistre = (champ: string) => secrets.find((s) => s.field === champ);

  return (
    <div className="flex flex-col gap-4">
      {config.champs.length > 0 ? (
        <form action={enregistrer} className="flex flex-col gap-4">
          <input type="hidden" name="fournisseur" value={config.cle} />

          {config.champs.map((champ) => {
            const pose = champ.secret ? enregistre(champ.cle) : undefined;
            const id = `${config.cle}-${champ.cle}`;

            return (
              <div key={champ.cle}>
                <Field label={champ.libelle} htmlFor={id}>
                  {champ.type === "choix" ? (
                    <select
                      id={id}
                      name={champ.cle}
                      defaultValue={
                        valeurs[champ.cle] ?? champ.options?.[0]?.valeur
                      }
                      className="min-h-12 w-full rounded-control border border-line bg-surface px-3"
                    >
                      {champ.options?.map((option) => (
                        <option key={option.valeur} value={option.valeur}>
                          {option.libelle}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      name={champ.cle}
                      type={champ.secret ? "password" : "text"}
                      autoComplete="off"
                      defaultValue={
                        champ.secret ? "" : (valeurs[champ.cle] ?? "")
                      }
                      placeholder={
                        champ.secret && pose
                          ? "Enregistrée — laissez vide pour la conserver"
                          : champ.placeholder
                      }
                    />
                  )}
                </Field>

                <p className="mt-1 text-sm text-ink-soft">{champ.aide}</p>

                {pose ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <Badge ton="signal">Configurée</Badge>
                    <span className="tabular text-ink-faint">
                      …{pose.last4} · empreinte {pose.fingerprint}
                    </span>
                    <span className="text-ink-faint">
                      modifiée le{" "}
                      {new Date(pose.updated_at).toLocaleDateString("fr-BE", {
                        timeZone: "Europe/Brussels",
                      })}
                    </span>
                  </div>
                ) : null}

                {champ.variableEnv ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-ink-faint">
                      Nom technique
                    </summary>
                    <p className="mt-1 text-xs text-ink-faint">
                      <code>{champ.variableEnv}</code> — si cette variable
                      existe sur Vercel, elle sert de secours quand rien n’est
                      enregistré ici.
                    </p>
                  </details>
                ) : null}
              </div>
            );
          })}

          {etat.error ? (
            <p
              role="alert"
              className="rounded-control bg-urgent-soft px-3 py-2 text-sm"
            >
              {etat.error}
            </p>
          ) : null}
          {etat.success ? (
            <p className="rounded-control bg-signal-soft px-3 py-2 text-sm">
              {etat.success}
            </p>
          ) : null}

          <div>
            <Button type="submit" loading={enCours}>
              Enregistrer
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {config.testable ? (
          <form action={tester}>
            <input type="hidden" name="fournisseur" value={config.cle} />
            <Button type="submit" variant="secondary" loading={testEnCours}>
              Tester la connexion
            </Button>
          </form>
        ) : null}

        {config.champs
          .filter((champ) => champ.secret && enregistre(champ.cle))
          .map((champ) => (
            <form key={champ.cle} action={retirer}>
              <input type="hidden" name="fournisseur" value={config.cle} />
              <input type="hidden" name="champ" value={champ.cle} />
              <button
                type="submit"
                disabled={retraitEnCours}
                className="min-h-11 rounded-control border border-urgent px-3 text-sm font-medium text-urgent disabled:opacity-60"
              >
                Retirer « {champ.libelle} »
              </button>
            </form>
          ))}
      </div>

      {config.coutTest ? (
        <p className="text-sm text-ink-faint">{config.coutTest}</p>
      ) : null}

      {etatTest.test ? (
        <div
          className={
            etatTest.test.ok
              ? "rounded-control bg-signal-soft px-3 py-2.5 text-sm"
              : "rounded-control bg-urgent-soft px-3 py-2.5 text-sm"
          }
        >
          <p className="font-medium">
            {etatTest.test.ok ? "Test réussi" : "Test échoué"}
          </p>
          <p className="mt-0.5">{etatTest.test.message}</p>
          <p className="mt-1 text-ink-soft">
            Ce que ce test prouve : {etatTest.test.portee}. Il ne prouve pas
            qu’une opération métier réelle réussira.
          </p>
        </div>
      ) : null}

      {etatTest.error ? (
        <p
          role="alert"
          className="rounded-control bg-urgent-soft px-3 py-2 text-sm"
        >
          {etatTest.error}
        </p>
      ) : null}
      {etatRetrait.success ? (
        <p className="rounded-control bg-signal-soft px-3 py-2 text-sm">
          {etatRetrait.success}
        </p>
      ) : null}
      {etatRetrait.error ? (
        <p
          role="alert"
          className="rounded-control bg-urgent-soft px-3 py-2 text-sm"
        >
          {etatRetrait.error}
        </p>
      ) : null}
    </div>
  );
}
