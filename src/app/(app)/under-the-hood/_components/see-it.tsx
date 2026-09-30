"use client";
import { useActionState } from "react";
import { switchPersona } from "@/components/shell/demo-actions";
import { Button } from "@/components/ui/button";
import type { PersonaKey } from "@/config/personas";

export function SeeIt({
  persona,
  href,
  label,
}: {
  persona: PersonaKey;
  href: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(switchPersona, { status: "idle" });
  return (
    <form action={action}>
      <input type="hidden" name="persona" value={persona} />
      <input type="hidden" name="next" value={href} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {label}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="type-body-sm text-danger">
          {state.error.message}
        </p>
      )}
    </form>
  );
}
