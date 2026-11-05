"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Envoi d'une visite de page.
 *
 * Trois précautions, et elles ont toutes la même raison : la mesure ne doit
 * jamais abîmer la page qu'elle mesure.
 *
 * `keepalive` permet à la requête de survivre au départ de la page — sans
 * cela, une visite d'une seconde n'est jamais comptée.
 *
 * Les erreurs sont avalées. Un bloqueur de publicité qui refuse la requête est
 * le cas normal, pas une panne : il ne doit rien afficher à l'utilisateur.
 *
 * Rien n'est lu ni écrit dans le navigateur. Pas de cookie, pas de stockage
 * local, aucune empreinte calculée ici : le serveur décide seul, à partir de
 * ce qu'il voit de la requête.
 */
export function MesureVisite() {
  const chemin = usePathname();

  useEffect(() => {
    const parametres = new URLSearchParams(window.location.search);

    const corps = JSON.stringify({
      event: "PAGE_VIEW",
      path: chemin,
      referrer: document.referrer || undefined,
      utm: {
        source: parametres.get("utm_source") ?? undefined,
        medium: parametres.get("utm_medium") ?? undefined,
        campaign: parametres.get("utm_campaign") ?? undefined,
      },
      // Trois signaux que le serveur ne peut pas voir depuis la requête.
      webdriver: navigator.webdriver === true,
      visible: document.visibilityState === "visible",
      screen: window.screen?.width ?? 0,
    });

    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: corps,
      keepalive: true,
    }).catch(() => {
      /* bloqueur, hors ligne : la page continue */
    });
  }, [chemin]);

  return null;
}

/** Clic sur un bouton d'appel à l'action. Même discrétion. */
export function mesurerClic(chemin: string): void {
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "CTA_CLICK",
      path: chemin,
      webdriver: navigator.webdriver === true,
      visible: document.visibilityState === "visible",
      screen: window.screen?.width ?? 0,
    }),
    keepalive: true,
  }).catch(() => {});
}
