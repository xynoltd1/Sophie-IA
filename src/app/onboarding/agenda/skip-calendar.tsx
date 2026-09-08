"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { continueToSophie } from "./actions";

export function SkipCalendar() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="lg"
      loading={pending}
      onClick={() => startTransition(() => continueToSophie())}
    >
      Continuer sans agenda pour l&apos;instant
    </Button>
  );
}
