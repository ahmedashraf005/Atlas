import { expect, it } from "vitest";
import { notify } from "@/domain/effects";

it("keeps notification effects scoped to entity and recipient", () =>
  expect(notify("trade", "t", "buyer", "funds_due")).toEqual({
    type: "NOTIFY",
    entity: "trade",
    entityId: "t",
    recipient: "buyer",
    template: "funds_due",
  }));
