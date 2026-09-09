"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Installation de l'application sur l'ecran d'accueil.
 *
 * Ce n'est pas un confort. Sur iPhone, les notifications d'une application web
 * ne fonctionnent QUE si elle a ete installee. Or « rendez-vous a valider » est
 * le coeur du produit : sans notification, l'artisan doit penser a ouvrir
 * l'application, et il n'y pensera pas.
 *
 * Deux chemins tres differents :
 *   - Android et Chrome exposent l'evenement beforeinstallprompt, qu'on capture
 *     pour declencher l'installation nous-memes ;
 *   - iOS n'expose rien. Il faut expliquer le geste : Partager, puis « Sur
 *     l'ecran d'accueil ».
 *
 * Le bouton disparait entierement une fois l'application installee.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton({ className }: { className?: string }) {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true); // on masque jusqu'a preuve du contraire
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari iOS expose son propre indicateur, absent du type standard.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setInstalled(standalone);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    function capture(event: Event) {
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferred && !isIos) return null;

  async function install() {
    if (!deferred) {
      setShowIosHelp(true);
      return;
    }
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={cn(
          "flex min-h-10 shrink-0 items-center gap-1.5 rounded-control border border-signal",
          "px-3 text-sm font-medium text-signal-deep",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="m7 11 5 5 5-5" />
          <path d="M4 20h16" />
        </svg>
        Installer
      </button>

      {showIosHelp ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-ios-titre"
          className="fixed inset-0 z-50 flex items-end bg-ink/40 p-4"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="w-full rounded-sheet bg-surface p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="install-ios-titre" className="font-display text-xl font-semibold">
              Ajouter Sophie à votre écran d’accueil
            </h2>
            <p className="mt-2 text-ink-soft">
              Vous recevrez les rendez-vous à valider directement sur votre téléphone.
            </p>
            <ol className="mt-4 flex flex-col gap-3 text-ink">
              <li>1. Touchez le bouton Partager, en bas de Safari.</li>
              <li>2. Faites défiler, puis touchez « Sur l’écran d’accueil ».</li>
              <li>3. Touchez « Ajouter ».</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="mt-5 min-h-12 w-full rounded-control bg-signal font-medium text-white"
            >
              J’ai compris
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
