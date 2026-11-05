"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/platform";
import { journaliserAdmin } from "@/lib/platform/audit";
import {
  empreinte,
  enregistrerReglages,
  enregistrerSecret,
  retirerSecret,
} from "@/lib/config/platform";
import { fournisseur } from "@/lib/config/catalogue";
import { testerFournisseur } from "@/lib/config/tests";

export interface IntegrationState {
  error?: string;
  success?: string;
  /** Résultat d'un test, séparé du reste : il ne se confond pas avec un enregistrement. */
  test?: { ok: boolean; message: string; portee: string };
}

/**
 * Enregistre la configuration d'un fournisseur.
 *
 * ## Deux destinations, une seule soumission
 *
 * Les champs déclarés `secret` partent chiffrés dans `provider_credentials`.
 * Les autres partent en clair dans `platform_settings`. Le catalogue décide ;
 * le formulaire ne choisit rien.
 *
 * ## Un champ vide ne vide rien
 *
 * Les champs secrets arrivent vides à chaque affichage — ils ne sont jamais
 * réaffichés. Soumettre le formulaire sans y toucher doit donc **conserver**
 * la clé existante, pas l'effacer. Le retrait se fait par un bouton distinct,
 * qui dit ce qu'il fait.
 *
 * ## Ce qui n'est jamais journalisé
 *
 * La valeur. L'audit retient qui a changé quoi et quand, avec l'empreinte du
 * nouveau secret — assez pour prouver un remplacement, inutile pour s'en
 * servir.
 */
export async function enregistrerFournisseur(
  _prev: IntegrationState,
  formData: FormData,
): Promise<IntegrationState> {
  const cle = String(formData.get("fournisseur") ?? "");
  const config = fournisseur(cle);

  if (!config || !config.implemente) {
    return { error: "Ce fournisseur n’est pas configurable." };
  }

  const { userId } = await requirePlatformAdmin();

  const reglagesClairs: Record<string, unknown> = {};
  const empreintes: Record<string, string> = {};

  for (const champ of config.champs) {
    const brut = formData.get(champ.cle);
    const valeur = typeof brut === "string" ? brut.trim() : "";

    if (champ.secret) {
      if (valeur.length === 0) continue; // on conserve l'existant
      const resultat = await enregistrerSecret({
        provider: cle,
        field: champ.cle,
        valeur,
        parQui: userId,
      });
      if (!resultat.ok)
        return { error: resultat.erreur ?? "Enregistrement refusé." };
      empreintes[champ.cle] = empreinte(valeur);
    } else {
      reglagesClairs[champ.cle] = valeur;
    }
  }

  if (Object.keys(reglagesClairs).length > 0) {
    const ok = await enregistrerReglages(cle, reglagesClairs, userId);
    if (!ok) return { error: "Les réglages n’ont pas pu être enregistrés." };
  }

  await journaliserAdmin({
    actorUserId: userId,
    action: "integration.configure",
    resourceType: "provider_credentials",
    resourceId: cle,
    details: {
      reglages: Object.keys(reglagesClairs),
      // Les empreintes, jamais les valeurs.
      secrets: empreintes,
    },
  });

  return {
    success:
      "Enregistré. La nouvelle configuration s’applique d’ici une minute, sans redéploiement.",
  };
}

/** Retire un secret. L'adaptateur retombe alors sur la variable d'environnement, si elle existe. */
export async function effacerSecret(
  _prev: IntegrationState,
  formData: FormData,
): Promise<IntegrationState> {
  const parsed = z
    .object({ fournisseur: z.string().min(1), champ: z.string().min(1) })
    .safeParse({
      fournisseur: formData.get("fournisseur"),
      champ: formData.get("champ"),
    });

  if (!parsed.success) return { error: "Demande invalide." };

  const { userId } = await requirePlatformAdmin();
  const ok = await retirerSecret(parsed.data.fournisseur, parsed.data.champ);

  if (!ok) return { error: "Le retrait a échoué." };

  await journaliserAdmin({
    actorUserId: userId,
    action: "integration.revoke",
    resourceType: "provider_credentials",
    resourceId: `${parsed.data.fournisseur}:${parsed.data.champ}`,
  });

  revalidatePath("/admin/integrations");
  return {
    success:
      "Clé retirée. S’il existe une variable d’environnement de même rôle, elle reprend la main.",
  };
}

/**
 * Lance un test de connexion.
 *
 * Le résultat est écrit dans `integration_checks`, donc visible ensuite sur
 * l'écran de santé comme preuve datée.
 */
export async function lancerTest(
  _prev: IntegrationState,
  formData: FormData,
): Promise<IntegrationState> {
  const cle = String(formData.get("fournisseur") ?? "");
  const config = fournisseur(cle);

  if (!config?.testable) return { error: "Aucun test pour ce fournisseur." };

  const { userId } = await requirePlatformAdmin();
  const resultat = await testerFournisseur(cle);

  await journaliserAdmin({
    actorUserId: userId,
    action: "integration.test",
    resourceType: "integration_checks",
    resourceId: cle,
    outcome: resultat.ok ? "SUCCESS" : "ERROR",
    details: { portee: resultat.portee },
  });

  revalidatePath("/admin/integrations");
  revalidatePath("/admin/sante");

  return { test: { ...resultat } };
}
