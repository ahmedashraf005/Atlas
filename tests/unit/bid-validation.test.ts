import { expect, it } from "vitest";
import { validateBidForm } from "@/lib/bid-maths";

const listing = { minFillRaw: "2000", quantityRaw: "12000" };
const valid = { price: "35.50", quantity: "5000", minFill: "2000", rationale: "" };
it("validates bid fields before review with the server's quantity messages", () => {
  expect(validateBidForm(valid, listing)).toEqual({});
  expect(validateBidForm({ ...valid, quantity: "1000" }, listing).quantity).toBe(
    "Minimum for this listing is 2,000 sh.",
  );
  expect(validateBidForm({ ...valid, quantity: "13000" }, listing).quantity).toBe(
    "This listing offers 12,000 sh.",
  );
  expect(validateBidForm({ ...valid, minFill: "6000" }, listing).minFill).toBe(
    "Minimum fill can't exceed the bid quantity.",
  );
  expect(validateBidForm({ ...valid, price: "35.555" }, listing).price).toMatch(
    /two decimal places/,
  );
  expect(validateBidForm({ ...valid, price: "0" }, listing).price).toBe(
    "The value must be greater than zero.",
  );
  expect(validateBidForm({ ...valid, rationale: "x".repeat(501) }, listing).rationale).toBe(
    "Keep the rationale to 500 characters or fewer.",
  );
});
