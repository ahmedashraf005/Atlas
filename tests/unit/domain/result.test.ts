import { expect, it } from "vitest";
import { err, ok } from "@/domain/result";

it("preserves success values and error objects", () => {
  const v = { qty: 2n },
    e = { message: "Stopped" },
    r = ok(v);
  expect(r).toEqual({ ok: true, value: v });
  if (r.ok) expect(r.value).toBe(v);
  expect(err(e)).toEqual({ ok: false, error: e });
});
