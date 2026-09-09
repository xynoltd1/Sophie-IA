"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LEAD_STATUS_LABELS } from "@/lib/crm/pipeline";
import { changeLeadStatus } from "../actions";
import type { LeadStatus } from "@/types/database";
import { cn } from "@/lib/utils/cn";

export function StatusActions({
  leadId,
  options,
}: {
  leadId: string;
  options: LeadStatus[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm font-medium text-urgent">
          {error}
        </p>
      ) : null}

      {options.map((status) => (
        <button
          key={status}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const result = await changeLeadStatus(leadId, status);
              if (result?.error) setError(result.error);
              else router.refresh();
            })
          }
          className={cn(
            "min-h-12 rounded-control border border-line bg-surface px-4 text-left font-medium",
            "disabled:opacity-60",
            status === "LOST" && "text-ink-soft",
          )}
        >
          {LEAD_STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
