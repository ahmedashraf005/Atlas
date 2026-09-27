import { bidMachine } from "@/domain/bid";
import { holdingMachine } from "@/domain/holding";
import { listingMachine } from "@/domain/listing";
import { tradeMachine } from "@/domain/trade";
export { holdingMachine, listingMachine, bidMachine, tradeMachine };
export const MACHINES = {
  holding: holdingMachine,
  listing: listingMachine,
  bid: bidMachine,
  trade: tradeMachine,
} as const;
