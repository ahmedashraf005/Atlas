"use client";

import { FastForward, RotateCcw, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
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
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DEMO_PERSONA_OPTIONS } from "@/config/demo-viewer";

function DisabledHint({ children, text }: { children: ReactNode; text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the specified wrapper exposes a disabled control's tooltip to keyboard users. */}
        <span tabIndex={0} className="inline-flex shrink-0 rounded-sm">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

const actions = [
  // TODO(segment-2): advance sandbox clock and reset sandbox
  { label: "+1 day", icon: FastForward, segment: 2 },
  { label: "+30 days", segment: 2 },
  // TODO(segment-5): simulate competing bid
  { label: "Simulate competing bid", segment: 5 },
  // TODO(segment-2): reset sandbox
  { label: "Reset", icon: RotateCcw, segment: 2 },
] as const;

export function DemoControls() {
  return (
    <TooltipProvider>
      <div className="hidden min-w-0 items-center gap-2 overflow-x-auto py-1 lg:flex">
        {/* TODO(segment-2): enable persona switching */}
        <label htmlFor="persona" className="type-label text-ink-muted">
          View as
        </label>
        <DisabledHint text="Persona switching arrives in segment 2">
          <Select disabled value={DEMO_PERSONA_OPTIONS[0]}>
            <SelectTrigger id="persona" className="h-8 w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEMO_PERSONA_OPTIONS.map((persona) => (
                <SelectItem key={persona} value={persona}>
                  {persona}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DisabledHint>
        <Separator
          orientation="vertical"
          className="h-6 shrink-0 data-[orientation=vertical]:h-6"
        />
        {actions.map((action) => (
          <DisabledHint key={action.label} text={`Available from segment ${action.segment}`}>
            <Button variant="secondary" size="sm" disabled>
              {"icon" in action && <action.icon strokeWidth={1.5} aria-hidden />}
              {action.label}
            </Button>
          </DisabledHint>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Demo controls">
            <Settings2 strokeWidth={1.5} aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel>View as · available from segment 2</DropdownMenuLabel>
          {DEMO_PERSONA_OPTIONS.map((persona) => (
            <DropdownMenuItem key={persona} disabled>
              {persona}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {actions.map((action) => (
            <DropdownMenuItem disabled key={action.label}>
              {action.label}
              <span className="ml-auto type-label">Segment {action.segment}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
