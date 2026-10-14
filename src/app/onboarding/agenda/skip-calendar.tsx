"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { continueToSophie } from "./actions";

export function SkipCalendar({ connected }: { connected: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="lg"
      loading={pending}
      onClick={() => startTransition(() => continueToSophie())}
    >
      {connected ? "Continuer" : "Continuer sans agenda pour l\u2019instant"}
    </Button>
  );
}
