import { expect, it } from "vitest";
import * as errors from "@/domain/errors";

it("constructs the complete error contract without unrelated metadata", () => {
  const issue = { field: "price", message: "Enter a price." },
    failure = { code: "KYC_INCOMPLETE" as const, message: "Complete KYC." };
  const cases = [
    errors.invalidTransition("Draft", "EXPIRE"),
    errors.forbiddenRole(),
    errors.guardFailed("Give a reason."),
    errors.validation([issue]),
    errors.insufficientShares(),
    errors.policyBlocked([failure]),
    errors.selfDealing(),
    errors.duplicateBid(),
    errors.bidWindowClosed(),
    errors.forbidden("Not found."),
  ];
  expect(cases.map((c) => c.code)).toEqual([
    "INVALID_TRANSITION",
    "FORBIDDEN_ROLE",
    "GUARD_FAILED",
    "VALIDATION",
    "INSUFFICIENT_SHARES",
    "POLICY_BLOCKED",
    "SELF_DEALING",
    "DUPLICATE_BID",
    "BID_WINDOW_CLOSED",
    "FORBIDDEN",
  ]);
  expect(cases[3]?.issues).toEqual([issue]);
  expect(cases[5]?.failures).toEqual([failure]);
  for (const c of cases) {
    expect(c.message).not.toContain("!");
    if (c.code !== "VALIDATION") expect(c).not.toHaveProperty("issues");
    if (c.code !== "POLICY_BLOCKED") expect(c).not.toHaveProperty("failures");
  }
});
