"use client";
import { Settings2 } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import {
  advanceClock,
  resetSandbox,
  setRofrMode,
  simulateCompetingBid,
  switchPersona,
  toggleAutopilot,
} from "@/components/shell/demo-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERSONAS, type PersonaKey } from "@/config/personas";
export function DemoControls({
  persona,
  autopilot,
  rofrMode,
}: {
  persona: PersonaKey;
  autopilot: boolean;
  rofrMode: "waive" | "exercise";
}) {
  const [pending, start] = useTransition();
  const [personaState, selectPersona, selectPending] = useActionState(switchPersona, {
    status: "idle",
  });
  useEffect(() => {
    if (personaState.status === "error") toast.error(personaState.error.message);
  }, [personaState]);
  const run = (task: () => Promise<{ status: string; error?: { message: string } }>) =>
    start(async () => {
      const result = await task();
      if (result.status === "error")
        toast.error(result.error?.message ?? "Something went wrong. Try again.");
    });
  const changePersona = (value: PersonaKey) => start(() => selectPersona({ persona: value }));
  const busy = pending || selectPending;
  const resetTrigger = (
    <Button variant="secondary" size="sm" disabled={busy}>
      Reset
    </Button>
  );
  const reset = (
    <ConfirmDialog
      trigger={resetTrigger}
      title="Reset the demo?"
      description="This restores every company, listing and trade to its starting point. Your changes in this sandbox are lost."
      confirmLabel="Reset demo"
      tone="danger"
      onConfirm={() => run(() => resetSandbox({ status: "idle" }, {}))}
    />
  );
  const more = (mobile: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={mobile ? "icon-sm" : "sm"}
          className={mobile ? "lg:hidden" : "hidden lg:inline-flex"}
          aria-label={mobile ? "Demo controls" : "More demo controls"}
        >
          {mobile ? <Settings2 strokeWidth={1.5} aria-hidden /> : "More"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[calc(100vw-2rem)]">
        {mobile && (
          <>
            <DropdownMenuLabel>View as</DropdownMenuLabel>
            {PERSONAS.map((p) => (
              <DropdownMenuItem key={p.key} disabled={busy} onSelect={() => changePersona(p.key)}>
                {p.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {([24, 168, 720] as const).map((hours) => (
              <DropdownMenuItem
                key={hours}
                disabled={busy}
                onSelect={() => run(() => advanceClock({ status: "idle" }, { hours }))}
              >
                +{hours / 24} {hours === 24 ? "day" : "days"}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              disabled={busy}
              onSelect={() => run(() => toggleAutopilot({ status: "idle" }, {}))}
            >
              Auto-pilot {autopilot ? "on" : "off"}
            </DropdownMenuItem>
          </>
        )}
        {mobile && (
          <ConfirmDialog
            trigger={
              <DropdownMenuItem disabled={busy} onSelect={(event) => event.preventDefault()}>
                Reset
              </DropdownMenuItem>
            }
            title="Reset the demo?"
            description="This restores every company, listing and trade to its starting point. Your changes in this sandbox are lost."
            confirmLabel="Reset demo"
            tone="danger"
            onConfirm={() => run(() => resetSandbox({ status: "idle" }, {}))}
          />
        )}
        <DropdownMenuCheckboxItem
          checked={rofrMode === "exercise"}
          disabled={busy}
          onCheckedChange={(value) =>
            run(() => setRofrMode({ status: "idle" }, { mode: value ? "exercise" : "waive" }))
          }
        >
          Company exercises ROFR
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem
          disabled={busy}
          onSelect={() =>
            run(async () => {
              const result = await simulateCompetingBid({ status: "idle" }, {});
              if (result.status === "success") toast.success(result.data.message);
              return result;
            })
          }
        >
          Simulate competing bid
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <div className="flex min-w-0 items-center gap-2">
      <section
        aria-label="Persona and time controls"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard scrolling is required for this labelled overflow region, including Safari.
        tabIndex={0}
        className="hidden min-w-0 items-center gap-2 overflow-x-auto py-1 lg:flex focus-visible:outline-2 focus-visible:outline-focus-ring"
      >
        <label htmlFor="persona" className="shrink-0 whitespace-nowrap type-label text-ink-muted">
          View as
        </label>
        <Select
          value={persona}
          disabled={busy}
          onValueChange={(value) => changePersona(value as PersonaKey)}
        >
          <SelectTrigger id="persona" className="h-8 w-64 shrink-0 whitespace-nowrap">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERSONAS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {([24, 168, 720] as const).map((hours) => (
          <Button
            key={hours}
            className="shrink-0"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => run(() => advanceClock({ status: "idle" }, { hours }))}
          >
            +{hours / 24} {hours === 24 ? "day" : "days"}
          </Button>
        ))}
      </section>
      {more(false)}
      {more(true)}
      <span className="hidden lg:inline-flex">{reset}</span>
      <Button
        className="hidden md:inline-flex"
        variant="ghost"
        size="sm"
        aria-pressed={autopilot}
        disabled={busy}
        onClick={() => run(() => toggleAutopilot({ status: "idle" }, {}))}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${autopilot ? "bg-success" : "bg-line-strong"}`}
        />
        Auto-pilot {autopilot ? "on" : "off"}
      </Button>
    </div>
  );
}
