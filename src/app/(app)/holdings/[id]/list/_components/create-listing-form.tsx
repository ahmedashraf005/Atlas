"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { createListing } from "@/app/_actions/holdings";
import { SectionCard } from "@/components/atlas/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMoneyInput, parseSharesInput } from "@/domain/money";
import { formatMoney, formatShares } from "@/lib/format";
import type { ListingData } from "@/server/actions/holdings";
import type { ActionState } from "@/server/actions/pipeline";
import type { CreateListingModel } from "@/server/read/create-listing";
import { type ListingValues, listingPreview, validateListing } from "./listing-preview";
export function CreateListingForm({ model }: { model: CreateListingModel }) {
  const [values, setValues] = useState<ListingValues>({
    quantity: model.maxSellable,
    minFill: model.minLot,
    reservePrice: "",
    windowDays: "5",
  });
  const [review, setReview] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [issues, setIssues] = useState<Record<string, string>>({}),
    [requestId, setRequestId] = useState("");
  const [state, action, pending] = useActionState<ActionState<ListingData>, FormData>(
    createListing,
    { status: "idle" },
  );
  const router = useRouter(),
    id = useId();
  useEffect(() => {
    setRequestId(crypto.randomUUID());
  }, []);
  useEffect(() => {
    if (state.status === "success") {
      toast.success(`Listing ${state.data.ref} submitted for review.`);
      router.push("/holdings");
    } else if (state.status === "error" && state.error.code === "VALIDATION") {
      setIssues(Object.fromEntries((state.error.issues ?? []).map((i) => [i.field, i.message])));
      setReview(false);
    }
  }, [state, router]);
  const preview = listingPreview(values.quantity, values.reservePrice, model.currency, model.band);
  const change = (field: keyof ListingValues, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setIssues((i) => {
      const next = { ...i };
      delete next[field];
      return next;
    });
  };
  const fields = [
    {
      key: "quantity",
      label: "Quantity",
      helper: `Up to ${model.maxLabel} · minimum lot ${model.minLabel}`,
    },
    { key: "minFill", label: "Minimum fill", helper: "The smallest amount one buyer can take." },
    {
      key: "reservePrice",
      label: "Reserve price per share",
      helper: "Hidden from buyers. Bids below it can still be countered.",
    },
  ] as const;
  const quantity = parseSharesInput(values.quantity),
    minFill = parseSharesInput(values.minFill),
    price = parseMoneyInput(values.reservePrice);
  const summary = [
    { label: "Company and class", value: `${model.company} · ${model.shareClass}` },
    { label: "Quantity", value: quantity.ok ? formatShares(quantity.value, "table") : "—" },
    { label: "Minimum fill", value: minFill.ok ? formatShares(minFill.value, "table") : "—" },
    {
      label: "Reserve",
      value: `${price.ok ? formatMoney(price.value, model.currency, "perShare") : "—"} · Hidden from buyers`,
    },
    { label: "Bid window", value: `${values.windowDays} days after approval` },
    {
      label: "At reserve",
      value:
        price.ok && quantity.ok ? formatMoney(price.value * quantity.value, model.currency) : "—",
    },
  ];
  return (
    <SectionCard title={review ? "Review listing" : "Listing details"}>
      {!review ? (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const next = validateListing(values, model);
            setIssues(next);
            if (!Object.keys(next).length) setReview(true);
          }}
          className="space-y-5"
        >
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`${id}-${field.key}`}>{field.label}</Label>
              <div className="flex items-center gap-2">
                {field.key === "reservePrice" && (
                  <span className="type-label text-ink-muted">{model.currency}</span>
                )}
                <Input
                  id={`${id}-${field.key}`}
                  inputMode={field.key === "reservePrice" ? "decimal" : "numeric"}
                  value={values[field.key]}
                  onChange={(e) => change(field.key, e.target.value)}
                  aria-invalid={!!issues[field.key]}
                  aria-describedby={`${id}-${field.key}-help${issues[field.key] ? ` ${id}-${field.key}-error` : ""}`}
                />
              </div>
              <p id={`${id}-${field.key}-help`} className="type-body-sm text-ink-muted">
                {field.helper}
              </p>
              {issues[field.key] && (
                <p
                  id={`${id}-${field.key}-error`}
                  role="alert"
                  className="type-body-sm text-danger"
                >
                  {issues[field.key]}
                </p>
              )}
            </div>
          ))}
          <fieldset className="space-y-2">
            <legend className="type-body font-medium">Bid window</legend>
            <div className="flex flex-wrap gap-5">
              {(["3", "5", "7"] as const).map((day) => (
                <label key={day} className="flex items-center gap-2 type-body-sm">
                  <input
                    type="radio"
                    name="windowDays"
                    value={day}
                    checked={values.windowDays === day}
                    onChange={() => change("windowDays", day)}
                    className="accent-atlas-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                  />
                  {day} days
                </label>
              ))}
            </div>
            <p className="type-body-sm text-ink-muted">
              Buyers bid privately until the window closes.
            </p>
          </fieldset>
          <div aria-live="polite" className="rounded-sm bg-surface-sunken p-4 space-y-1">
            <p className="type-body font-medium">At your reserve: {preview.total}</p>
            <p className="type-body-sm text-ink-muted">{preview.comparison}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" asChild>
              <Link href="/holdings">Cancel</Link>
            </Button>
            <Button type="submit">Review listing</Button>
          </div>
        </form>
      ) : (
        <form action={action} className="space-y-5">
          <input type="hidden" name="holdingId" value={model.holdingId} />
          <input type="hidden" name="clientRequestId" value={requestId} />
          <input type="hidden" name="confirmedOwnership" value={confirmed ? "true" : "false"} />
          {Object.entries(values).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <dl className="space-y-3 type-body-sm">
            {summary.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2">
                <dt className="text-ink-muted">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2">
            <h3 className="type-title">What happens next</h3>
            <ol className="list-decimal pl-5 space-y-2 type-body-sm">
              <li>Atlas reviews the listing. Usually a few seconds in this demo.</li>
              <li>Approved buyers bid privately for {values.windowDays} days.</li>
              <li>You review the sealed bids, can counter up to three, and accept one or more.</li>
              <li>
                {model.company} has {model.rofrDays} days to buy the shares itself at the same price
                (right of first refusal).
              </li>
              <li>
                The buyer pays into escrow; you&apos;re paid once the company updates its share
                register.
              </li>
            </ol>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`${id}-confirmed`}
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
            />
            <Label htmlFor={`${id}-confirmed`} className="type-body-sm leading-normal">
              I confirm I own these shares and they are free of any other claim.
            </Label>
          </div>
          {state.status === "error" &&
            (state.error.code === "POLICY_BLOCKED" ? (
              <div role="alert" className="rounded-sm bg-danger-soft text-danger p-4">
                <ul className="list-disc pl-4 type-body-sm">
                  {state.error.failures?.map((f) => (
                    <li key={f.code}>{f.message}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p role="alert" className="type-body-sm text-danger">
                {state.error.message}
              </p>
            ))}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setReview(false)}
            >
              Back
            </Button>
            <Button type="submit" disabled={!confirmed || !requestId || pending}>
              {pending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}
