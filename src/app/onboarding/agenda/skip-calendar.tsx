"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { continueToZeli } from "./actions";

export function SkipCalendar({ connected }: { connected: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="lg"
      loading={pending}
      onClick={() => startTransition(() => continueToZeli())}
    >
      {connected ? "Continuer" : "Continuer sans agenda pour l\u2019instant"}
    </Button>
  );
}
