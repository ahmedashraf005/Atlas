import { expect, it } from "vitest";
import {
  bidMachine,
  holdingMachine,
  listingMachine,
  MACHINES,
  tradeMachine,
} from "@/domain/machines";

it("registers the four authoritative definitions", () => {
  expect(MACHINES).toEqual({
    holding: holdingMachine,
    listing: listingMachine,
    bid: bidMachine,
    trade: tradeMachine,
  });
});
