"use client";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { createHolding } from "@/app/_actions/holdings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HoldingData } from "@/server/actions/holdings";
import type { ActionState } from "@/server/actions/pipeline";
import type { HoldingsModel } from "@/server/read/holdings";
export function AddHoldingDialog({
  companies,
  today,
  primary = true,
}: {
  companies: HoldingsModel["companies"];
  today: string;
  primary?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [companyId, setCompany] = useState(""),
    [shareClassId, setClass] = useState("");
  const [state, action, pending] = useActionState<ActionState<HoldingData>, FormData>(
    createHolding,
    { status: "idle" },
  );
  const id = useId();
  useEffect(() => {
    if (state.status === "success") {
      setOpen(false);
      toast.success("Holding submitted. The company is verifying it.");
    }
  }, [state]);
  const error = (field: string) =>
    state.status === "error"
      ? state.error.issues?.find((i) => i.field === field)?.message
      : undefined;
  const described = (field: string) => (error(field) ? `${id}-${field}-error` : undefined);
  const fieldError = (field: string) =>
    error(field) && (
      <p id={`${id}-${field}-error`} className="type-body-sm text-danger">
        {error(field)}
      </p>
    );
  const classes = companies.find((c) => c.id === companyId)?.classes ?? [];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={primary ? "primary" : "secondary"}>Add holding</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a holding</DialogTitle>
          <DialogDescription>
            The company verifies the shares against its register.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor={`${id}-companyId`}>Company</Label>
            <Select
              name="companyId"
              value={companyId}
              onValueChange={(value) => {
                setCompany(value);
                setClass("");
              }}
            >
              <SelectTrigger
                id={`${id}-companyId`}
                className="w-full"
                aria-describedby={described("companyId")}
                aria-invalid={!!error("companyId")}
              >
                <SelectValue placeholder="Choose a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("companyId")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-shareClassId`}>Share class</Label>
            <Select
              name="shareClassId"
              value={shareClassId}
              onValueChange={setClass}
              disabled={!companyId}
            >
              <SelectTrigger
                id={`${id}-shareClassId`}
                className="w-full"
                aria-describedby={described("shareClassId")}
                aria-invalid={!!error("shareClassId")}
              >
                <SelectValue placeholder="Choose a share class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldError("shareClassId")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-quantity`}>Number of shares</Label>
            <Input
              id={`${id}-quantity`}
              name="quantity"
              inputMode="numeric"
              required
              aria-describedby={described("quantity")}
              aria-invalid={!!error("quantity")}
            />
            {fieldError("quantity")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-acquiredOn`}>Date acquired</Label>
            <Input
              id={`${id}-acquiredOn`}
              name="acquiredOn"
              type="date"
              max={today}
              required
              aria-describedby={described("acquiredOn")}
              aria-invalid={!!error("acquiredOn")}
            />
            {fieldError("acquiredOn")}
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${id}-evidence`}>Evidence</Label>
            <Select name="evidence" defaultValue="share_certificate">
              <SelectTrigger
                id={`${id}-evidence`}
                className="w-full"
                aria-describedby={`${id}-evidence-help`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="share_certificate">Share certificate</SelectItem>
                <SelectItem value="cap_table_extract">Cap table extract</SelectItem>
              </SelectContent>
            </Select>
            <p id={`${id}-evidence-help`} className="type-body-sm text-ink-muted">
              In this demo no file is uploaded. The company checks the holding against its register.
            </p>
            {fieldError("evidence")}
          </div>
          {state.status === "error" && (
            <p role="alert" className="type-body-sm text-danger">
              {state.error.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit for verification"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
