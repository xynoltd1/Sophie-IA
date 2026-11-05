"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Sheet, SectionTitle } from "@/components/ui/sheet";
import { marquerLue, toutMarquerLu } from "./actions";
import type { LigneNotification } from "./page";

const TONES = {
  CRITIQUE: "urgent",
  ACTION: "attention",
  INFO: "neutral",
} as const;

export function ListeNotifications({
  nonLues,
  lues,
}: {
  nonLues: LigneNotification[];
  lues: LigneNotification[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  return (
    <>
      {nonLues.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <SectionTitle>À voir</SectionTitle>
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                demarrer(async () => {
                  await toutMarquerLu();
                  router.refresh();
                })
              }
              className="text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
            >
              Tout marquer comme lu
            </button>
          </div>

          <ul className="flex flex-col gap-2">
            {nonLues.map((notification) => (
              <li key={notification.id}>
                <Lien href={notification.href}>
                  <Sheet
                    tone={TONES[notification.category]}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{notification.title}</p>
                      {notification.body ? (
                        <p className="mt-0.5 text-sm text-ink-soft">
                          {notification.body}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-ink-faint first-letter:uppercase">
                        {quand(notification.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={(e) => {
                        e.preventDefault();
                        demarrer(async () => {
                          await marquerLue(notification.id);
                          router.refresh();
                        });
                      }}
                      className="shrink-0 text-sm text-ink-soft underline underline-offset-4 disabled:opacity-60"
                    >
                      Lu
                    </button>
                  </Sheet>
                </Lien>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lues.length > 0 ? (
        <section>
          <SectionTitle>Déjà vues</SectionTitle>
          <ul className="flex flex-col gap-2">
            {lues.map((notification) => (
              <li key={notification.id}>
                <Lien href={notification.href}>
                  <Sheet className="opacity-70">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-sm text-ink-faint first-letter:uppercase">
                      {quand(notification.created_at)}
                    </p>
                  </Sheet>
                </Lien>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Lien({
  href,
  children,
}: {
  href: string | null;
  children: React.ReactNode;
}) {
  if (!href) return <>{children}</>;
  return (
    <Link href={href} className="block">
      {children}
    </Link>
  );
}

function quand(iso: string): string {
  return new Date(iso).toLocaleString("fr-BE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Brussels",
  });
}
