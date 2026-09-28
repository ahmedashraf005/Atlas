import { Lock } from "lucide-react";
import Link from "next/link";
import { Deadline } from "@/components/atlas/deadline";
import { SectionCard } from "@/components/atlas/section-card";
import { StatusBadge } from "@/components/atlas/status-badge";
import type { TradeRoomModel } from "@/server/read/trades";
import { TradeActionButton } from "./actions";
export function PaymentInstructions({ summary }: { summary: TradeRoomModel["summary"] }) {
  return (
    <section
      className="rounded-md border border-line p-4 flex flex-col gap-3"
      aria-label="Locked payment instructions"
    >
      <div className="flex items-center gap-2">
        <Lock size={16} strokeWidth={1.5} className="text-ink-muted" aria-hidden />
        <span className="type-title">Payment instructions</span>
        <StatusBadge tone="neutral">Locked</StatusBadge>
      </div>
      <dl className="flex flex-col gap-2 type-body-sm">
        {[
          ["Account name", "Atlas Client Escrow (demo)"],
          ["Bank", "Demo Bank of the Emirates"],
          ["IBAN", "AE07 0000 0000 0000 0000 000 (fictional)"],
          ["Reference", summary.escrowRef],
          ["Amount", summary.total],
        ].map(([label, value]) => (
          <div key={label} className="grid grid-cols-[6rem_1fr] gap-3">
            <dt className="text-ink-muted">{label}</dt>
            <dd className={label === "Reference" ? "type-mono break-all" : "min-w-0 break-words"}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="type-body-sm text-ink-muted">
        These details are fixed for this trade and never change by message or email. If anyone sends
        you different payment details, don't pay — contact Atlas.
      </p>
    </section>
  );
}
export function NextStep({ model }: { model: TradeRoomModel }) {
  const step = model.nextStep;
  return (
    <SectionCard title="Next step">
      <div className={step.success ? "rounded-md bg-success-soft text-success p-4" : "type-body"}>
        <p>{step.text}</p>
        {step.certificateHref && (
          <Link
            href={step.certificateHref}
            className="inline-block mt-3 underline focus-visible:outline-2 focus-visible:outline-focus-ring"
          >
            View completion certificate
          </Link>
        )}
      </div>
      {step.helper && <p className="type-body-sm text-ink-muted">{step.helper}</p>}
      {step.deadline && (
        <p className="type-body-sm">
          <Deadline at={step.deadline} now={model.now} prefix="Deadline" />
        </p>
      )}
      {step.payment && <PaymentInstructions summary={model.summary} />}
      <div className="flex flex-wrap items-start gap-3">
        {step.actions.map((action) => (
          <TradeActionButton key={action.key} tradeId={model.id} action={action} />
        ))}
      </div>
    </SectionCard>
  );
}
