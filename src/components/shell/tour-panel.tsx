"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { switchPersona } from "@/components/shell/demo-actions";
import { Button } from "@/components/ui/button";
import type { PersonaKey } from "@/config/personas";
import { readTourStep, TOUR_STEPS } from "@/lib/tour";

const TOUR_EVENT = "atlas-tour-open";
export function StartTourButton() {
  return (
    <Button variant="secondary" onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
      Start guided tour
    </Button>
  );
}
export function TourPanel({
  persona,
  hasTradeInProgress,
}: {
  persona: PersonaKey;
  hasTradeInProgress: boolean;
}) {
  const [step, setStep] = useState<number | null>(null);
  const [minimised, setMinimised] = useState(false);
  const [pending, startTransition] = useTransition();
  const title = useRef<HTMLHeadingElement>(null),
    router = useRouter();
  useEffect(() => {
    try {
      setStep(readTourStep(localStorage.getItem("atlas_tour")));
    } catch {
      /* Tour also works without storage. */
    }
    const open = () => {
        setMinimised(false);
        setStep(0);
      },
      close = (event: KeyboardEvent) => {
        if (event.key === "Escape") setStep(null);
      };
    window.addEventListener(TOUR_EVENT, open);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener(TOUR_EVENT, open);
      window.removeEventListener("keydown", close);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("atlas_tour", JSON.stringify(step));
    } catch {
      /* Private browsing can disable storage. */
    }
    if (step !== null && !minimised) title.current?.focus();
  }, [step, minimised]);
  const current = step === null ? null : TOUR_STEPS[step];
  if (!current || step === null) return null;
  const returnToBids = step === 2 && !hasTradeInProgress;
  const destination = returnToBids ? "/bids" : current.href;
  function navigate() {
    if (!current) return;
    startTransition(async () => {
      if (current.persona && current.persona !== persona) {
        const result = await switchPersona(
          { status: "idle" },
          { persona: current.persona, next: destination },
        );
        if (result.status === "error") toast.error(result.error.message);
      } else router.push(destination);
    });
  }
  if (minimised)
    return (
      <button
        type="button"
        aria-label={`Restore guided tour, step ${step + 1} of 8`}
        onClick={() => setMinimised(false)}
        className="fixed bottom-6 left-6 z-30 rounded-md border border-line bg-surface px-4 py-2 shadow-overlay type-body-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        Tour · Step {step + 1} of 8
      </button>
    );
  return (
    <section
      aria-label="Guided tour"
      className="fixed inset-x-0 bottom-0 z-30 flex max-h-[65dvh] flex-col gap-3 overflow-y-auto rounded-t-md border border-line bg-surface p-5 shadow-overlay md:inset-x-auto md:left-6 md:bottom-6 md:w-96 md:rounded-md"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="type-label text-ink-muted">Step {step + 1} of 8</p>
        <Button variant="link" size="sm" onClick={() => setMinimised(true)}>
          Minimise
        </Button>
      </div>
      <h2
        ref={title}
        tabIndex={-1}
        className="type-title focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        {current.title}
      </h2>
      <p className="type-body-sm">
        {returnToBids
          ? "Accept the counter in step 2 first — your trade appears here."
          : current.text}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={navigate}>
          Take me there
        </Button>
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        <Button variant="secondary" disabled={step === 7} onClick={() => setStep(step + 1)}>
          Next
        </Button>
        <Button variant="link" onClick={() => setStep(null)}>
          End tour
        </Button>
      </div>
    </section>
  );
}
