import { expect, it } from "vitest";
import { plural } from "@/lib/plural";

it("uses the singular at one and supports irregular forms", () => {
  expect(plural(0, "company", "companies")).toBe("0 companies");
  expect(plural(1, "company", "companies")).toBe("1 company");
  expect(plural(2, "bid")).toBe("2 bids");
  expect(plural(1, "buyer has a mandate", "buyers have mandates")).toBe("1 buyer has a mandate");
});
