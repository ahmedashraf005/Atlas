import { expect, it } from "vitest";
import { listingPublicColumns } from "@/server/repositories/listings";

it("public listing columns exclude the reserve in JS and SQL names", () => {
  expect(Object.keys(listingPublicColumns)).not.toContain("reservePriceMinor");
  expect(Object.values(listingPublicColumns).map((c) => c.name)).not.toContain(
    "reserve_price_minor",
  );
  expect(listingPublicColumns.quantity).toBeDefined();
});
