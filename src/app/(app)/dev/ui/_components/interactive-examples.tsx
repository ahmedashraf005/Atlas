"use client";

import { Check, Inbox } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ButtonExamples() {
  return (
    <div className="flex flex-col gap-4">
      {(["primary", "secondary", "ghost", "danger", "link"] as const).map((variant) => (
        <div key={variant} className="flex flex-wrap items-center gap-3">
          <span className="w-20 type-mono">{variant}</span>
          {(["sm", "md", "icon-sm", "icon"] as const).map((size) => (
            <Button
              key={size}
              variant={variant}
              size={size}
              aria-label={size.startsWith("icon") ? `${variant} ${size} example` : undefined}
            >
              {size.startsWith("icon") ? <Check strokeWidth={1.5} aria-hidden /> : size}
            </Button>
          ))}
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} loading>
            Loading
          </Button>
        </div>
      ))}
    </div>
  );
}

export function FormExamples() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <Label htmlFor="example-name">Reference</Label>
        <Input id="example-name" placeholder="Enter a reference" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="example-select">Share class</Label>
        <Select defaultValue="ordinary">
          <SelectTrigger id="example-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ordinary">Ordinary</SelectItem>
            <SelectItem value="preferred">Preferred</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="example-notes">Notes</Label>
        <Textarea id="example-notes" placeholder="Add a note" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="example-error">Required reference</Label>
        <Input id="example-error" aria-invalid="true" aria-describedby="reference-error" />
        <p id="reference-error" className="type-body-sm text-danger">
          Enter a reference.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="example-checkbox" />
        <Label htmlFor="example-checkbox">Include completed examples</Label>
      </div>
      <div className="flex flex-col gap-3">
        <Label id="example-slider-label">Example range</Label>
        <Slider aria-labelledby="example-slider-label" defaultValue={[40]} max={100} step={1} />
      </div>
      <div className="min-w-0 md:col-span-2">
        <Tabs defaultValue="overview">
          <TabsList aria-label="Example tabs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Card title</CardTitle>
                <CardDescription>A surface card with a hairline border.</CardDescription>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                Form controls above are interactive examples.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="details">An alternate tab panel.</TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function OverlayExamples() {
  const [result, setResult] = useState("No example confirmed.");
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Example dialog</DialogTitle>
              <DialogDescription>A preview of the Atlas dialog surface.</DialogDescription>
            </DialogHeader>
            <p>No marketplace data is changed.</p>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>
        <ConfirmDialog
          trigger={<Button variant="secondary">Confirm example</Button>}
          title="Confirm example?"
          description="This only updates the showcase message."
          confirmLabel="Confirm"
          onConfirm={() => setResult("Primary example confirmed.")}
        />
        <ConfirmDialog
          trigger={<Button variant="secondary">Danger example</Button>}
          title="Confirm danger example?"
          description="This only updates the showcase message. No data is deleted."
          confirmLabel="Confirm danger"
          tone="danger"
          onConfirm={() => setResult("Danger example confirmed.")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">Open menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={() => setResult("Menu example selected.")}>
              Select example
            </DropdownMenuItem>
            <DropdownMenuItem disabled>Unavailable example</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary">Show tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Additional context for this example.</TooltipContent>
        </Tooltip>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Example sheet</SheetTitle>
              <SheetDescription>A panel for supporting information.</SheetDescription>
            </SheetHeader>
            <Inbox className="mx-4 size-6 text-ink-muted" strokeWidth={1.5} aria-hidden />
          </SheetContent>
        </Sheet>
        <Button
          variant="secondary"
          onClick={() =>
            toast.success("Success example", { description: "The example completed." })
          }
        >
          Success toast
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast.info("Info example", { description: "This is an informational example." })
          }
        >
          Info toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.error("Error example", { description: "This is an error example." })}
        >
          Error toast
        </Button>
      </div>
      <output className="mt-4 block type-body-sm text-ink-muted">{result}</output>
    </TooltipProvider>
  );
}
