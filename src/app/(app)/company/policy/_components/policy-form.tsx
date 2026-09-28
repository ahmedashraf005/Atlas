"use client";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { updatePolicy } from "@/app/_actions/policy";
import { ConfirmDialog } from "@/components/atlas/confirm-dialog";
import { SectionCard } from "@/components/atlas/section-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PriceVisibility } from "@/domain/types";
import { INVESTOR_LABELS, VISIBILITY_LABELS } from "@/lib/policy-display";
import type { ActionState } from "@/server/actions/pipeline";
import type { getPolicyModel } from "@/server/read/policy";

type Model = NonNullable<Awaited<ReturnType<typeof getPolicyModel>>>;
export function PolicyForm({ model }: { model: Model }) {
  const [editing, setEditing] = useState(false),
    [form, setForm] = useState(model.initial),
    [, start] = useTransition();
  const [state, dispatch, pending] = useActionState(
    async (
      prev: ActionState<{ message: string; slug: string }>,
      input: Parameters<typeof updatePolicy>[1],
    ) => {
      const result = await updatePolicy(prev, input);
      if (result.status === "success") {
        toast.success(result.data.message);
        setEditing(false);
      }
      return result;
    },
    { status: "idle" },
  );
  const numeric = [
    ["rofrDays", "Right of first refusal (days)", 7, 60],
    ["fundingDays", "Funding period (days)", 1, 10],
    ["minLot", "Minimum lot (shares)", 1, 100000],
    ["lockupMonths", "Lock-up (months)", 0, 36],
    ["yearlyLimit", "Yearly limit (%)", 1, 100],
  ] as const;
  if (!editing)
    return (
      <>
        {model.groups.map((g) => (
          <SectionCard key={g.title} title={g.title}>
            <dl className="flex flex-col gap-5">
              {g.rules.map((r) => (
                <div key={r.label}>
                  <dt className="type-label text-ink-muted">{r.label}</dt>
                  <dd className="type-title mt-1">{r.value}</dd>
                  <dd className="type-body-sm text-ink-muted mt-1">{r.explanation}</dd>
                </div>
              ))}
            </dl>
          </SectionCard>
        ))}
        <Button
          className="self-start"
          onClick={() => {
            setForm(model.initial);
            setEditing(true);
          }}
        >
          Edit policy
        </Button>
      </>
    );
  const toggle = <T extends string>(values: T[], value: T, checked: boolean) =>
    checked ? [...values, value] : values.filter((v) => v !== value);
  const ready =
    form.allowedBuyerTypes.length > 0 &&
    numeric.every(
      ([key, , min, max]) =>
        /^\d+$/.test(form[key]) &&
        (key === "minLot"
          ? BigInt(form[key]) >= 1n && BigInt(form[key]) <= 100000n
          : +form[key] >= min && +form[key] <= max),
    ) &&
    form.blackoutWindows.every(
      (w) => w.start && w.end > w.start && w.label.trim().length > 0 && w.label.length <= 60,
    );
  return (
    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
      <SectionCard title="Edit transfer policy">
        <div className="grid gap-4 md:grid-cols-2">
          {numeric.map(([key, label, min, max]) => (
            <div key={key} className="flex flex-col gap-2">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                type="number"
                min={min}
                max={max}
                step={1}
                required
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Eligible buyers">
        <div className="flex flex-col gap-3">
          {(Object.keys(INVESTOR_LABELS) as (keyof typeof INVESTOR_LABELS)[]).map((key) => (
            <Label key={key} className="flex items-center gap-2">
              <Checkbox
                checked={form.allowedBuyerTypes.includes(key)}
                onCheckedChange={(v) =>
                  setForm({
                    ...form,
                    allowedBuyerTypes: toggle(form.allowedBuyerTypes, key, v === true),
                  })
                }
              />
              {INVESTOR_LABELS[key]}
            </Label>
          ))}
        </div>
        <p className="type-body-sm text-ink-muted">Select at least one buyer type.</p>
      </SectionCard>
      <SectionCard title="Restricted organisations">
        <div className="grid gap-3 md:grid-cols-2">
          {model.orgs.map((o) => (
            <Label key={o.id} className="flex items-center gap-2">
              <Checkbox
                checked={form.blockedOrgIds.includes(o.id)}
                onCheckedChange={(v) =>
                  setForm({ ...form, blockedOrgIds: toggle(form.blockedOrgIds, o.id, v === true) })
                }
              />
              {o.name}
            </Label>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Who sees trade prices">
        <fieldset className="flex flex-col gap-3">
          <legend className="sr-only">Who sees trade prices</legend>
          {(Object.keys(VISIBILITY_LABELS) as PriceVisibility[]).map((key) => (
            <Label key={key} className="flex items-center gap-2">
              <input
                type="radio"
                name="priceVisibility"
                value={key}
                checked={form.priceVisibility === key}
                onChange={() => setForm({ ...form, priceVisibility: key })}
                className="accent-atlas-green focus-visible:outline-2 focus-visible:outline-focus-ring"
              />
              {VISIBILITY_LABELS[key]}
            </Label>
          ))}
        </fieldset>
      </SectionCard>
      <SectionCard title="Blackout windows">
        {form.blackoutWindows.length === 0 && <p className="type-body-sm text-ink-muted">None</p>}
        {form.blackoutWindows.map((w, index) => (
          <div
            key={`${index}-${form.blackoutWindows.length}`}
            className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto]"
          >
            {(["start", "end", "label"] as const).map((key) => (
              <div key={key} className="flex flex-col gap-2">
                <Label htmlFor={`blackout-${index}-${key}`}>
                  {key === "start" ? "Start date" : key === "end" ? "End date" : "Label"}
                </Label>
                <Input
                  id={`blackout-${index}-${key}`}
                  type={key === "label" ? "text" : "date"}
                  required
                  maxLength={key === "label" ? 60 : undefined}
                  value={w[key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      blackoutWindows: form.blackoutWindows.map((row, i) =>
                        i === index ? { ...row, [key]: e.target.value } : row,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="link"
              aria-label={`Remove blackout ${index + 1}`}
              onClick={() =>
                setForm({
                  ...form,
                  blackoutWindows: form.blackoutWindows.filter((_, i) => i !== index),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() =>
            setForm({
              ...form,
              blackoutWindows: [...form.blackoutWindows, { start: "", end: "", label: "" }],
            })
          }
        >
          Add blackout
        </Button>
      </SectionCard>
      {state.status === "error" && (
        <div role="alert" className="type-body-sm text-danger">
          <p>{state.error.message}</p>
          {state.error.issues?.map((i) => (
            <p key={i.field}>
              {i.field}: {i.message}
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <ConfirmDialog
          title="Save the new transfer policy?"
          description="It applies to new listings, bids and access requests. Trades already in progress keep their deadlines."
          confirmLabel="Save policy"
          trigger={
            <Button type="button" loading={pending} disabled={!ready}>
              Save policy
            </Button>
          }
          onConfirm={() => start(() => dispatch({ companyId: model.companyId, policy: form }))}
        />
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
