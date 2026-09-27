import { expect, it } from "vitest";
import { makeBid, makeCompany, makeHolding, makeListing, makeTrade } from "./helpers/fixtures";

it("fixtures satisfy the entity contracts and start at version one", () => {
  for (const entity of [makeHolding(), makeListing(), makeBid(), makeTrade()]) {
    expect(entity.version).toBe(1);
    expect(entity.sandboxId).toBe("sandbox");
    expect(typeof entity.quantity).toBe("bigint");
  }
  expect(makeCompany().lastRoundDate).toBeInstanceOf(Date);
});
