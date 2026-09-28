import { CircleAlert, CircleCheck } from "lucide-react";
import type { HoldingCardModel } from "@/server/read/holdings";
import { ResubmitHolding } from "./resubmit-holding";

export function EligibilityPanel({ holding }: { holding: HoldingCardModel }) {
  if (holding.status === "PendingCompany")
    return (
      <p className="px-5 pb-5 type-body-sm text-ink-muted">
        The company is checking this holding against its share register. Usually a few seconds in
        this demo.
      </p>
    );
  if (holding.status === "Rejected")
    return (
      <div className="px-5 pb-5 space-y-3">
        <p className="type-body-sm">Rejected by the company: {holding.rejectionReason}</p>
        <ResubmitHolding holdingId={holding.id} />
      </div>
    );
  const eligible = holding.eligible;
  return (
    <div className="px-5 pb-5 space-y-3">
      <p className="flex items-start gap-2 type-body font-semibold">
        {eligible ? (
          <CircleCheck
            className="mt-0.5 size-4 shrink-0 text-success"
            strokeWidth={1.5}
            aria-hidden
          />
        ) : (
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-warning"
            strokeWidth={1.5}
            aria-hidden
          />
        )}
        {holding.eligibility.message}
      </p>
      {eligible ? (
        <dl className="grid gap-x-6 gap-y-2 type-body-sm sm:grid-cols-2">
          {holding.eligibility.terms.map((term) => (
            <div key={term.label} className="flex flex-wrap justify-between gap-2">
              <dt className="text-ink-muted">{term.label}</dt>
              <dd>{term.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <>
          <ul className="list-disc space-y-1 pl-5 type-body-sm">
            {holding.eligibility.failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {holding.eligibility.nextEligible && (
            <p className="type-body-sm text-ink-muted">{holding.eligibility.nextEligible}</p>
          )}
        </>
      )}
    </div>
  );
}
