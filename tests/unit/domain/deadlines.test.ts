import { describe, expect, it } from "vitest";
import {
  dueBidEvent,
  dueListingEvent,
  dueTradeEvent,
  settleBidDeadlines,
  settleDeadlines,
  settleListingDeadlines,
  settleTradeDeadlines,
} from "@/domain/deadlines";
import { addDays } from "@/domain/time";
import { deepFreeze, makeBid, makeListing, makePolicy, makeTrade, NOW } from "./helpers/fixtures";

describe("deadlines", () => {
  it("settles a thirty-day jump at the actual deadlines", () => {
    const r = settleTradeDeadlines(
      deepFreeze(makeTrade({ status: "RofrPending", rofrDeadline: NOW, backupBidId: "backup" })),
      addDays(NOW, 30),
      makePolicy(),
    );
    expect(r.applied.map((a) => [a.event, a.effectiveAt])).toEqual([
      ["LAPSE", NOW],
      ["BUYER_DEFAULT", addDays(NOW, 5)],
    ]);
    expect(r.trade).toMatchObject({
      status: "Cancelled",
      cancelReason: "buyer_default",
      fundingDeadline: addDays(NOW, 5),
      version: 3,
    });
    expect(r.applied[1]?.effects).toContainEqual({
      type: "BACKUP_OR_RELEASE",
      listingId: "listing",
      holdingId: "holding",
      qty: 1000n,
      backupBidId: "backup",
    });
  });
  it("lists every due boundary and rejects earlier times", () => {
    const before = new Date(NOW.getTime() - 1);
    for (const status of ["Live", "Closed", "Negotiating"] as const) {
      const l = makeListing({ status, windowClosesAt: status === "Live" ? NOW : addDays(NOW, -7) });
      expect(dueListingEvent(l, NOW, { allTradesTerminal: false })?.event).toBe(
        status === "Live" ? "CLOSE_WINDOW" : "EXPIRE",
      );
      expect(dueListingEvent(l, before, { allTradesTerminal: false })).toBeNull();
    }
    expect(
      dueListingEvent(makeListing({ status: "Allocated" }), NOW, { allTradesTerminal: true }),
    ).toEqual({ kind: "listing", event: "COMPLETE", effectiveAt: NOW });
    expect(
      dueListingEvent(makeListing({ status: "Allocated" }), NOW, { allTradesTerminal: false }),
    ).toBeNull();
    expect(
      dueListingEvent(makeListing({ status: "Live", windowClosesAt: null }), NOW, {
        allTradesTerminal: true,
      }),
    ).toBeNull();
    for (const status of ["Countered", "Submitted", "Backup"] as const) {
      const b = makeBid({ status, counterExpiresAt: NOW, expiresAt: NOW });
      expect(dueBidEvent(b, NOW)?.event).toBe(status === "Countered" ? "COUNTER_EXPIRE" : "EXPIRE");
      expect(dueBidEvent(b, before)).toBeNull();
    }
    expect(dueBidEvent(makeBid({ status: "Countered" }), NOW)).toBeNull();
    for (const status of ["RofrPending", "AwaitingFunds"] as const) {
      const t = makeTrade({ status, rofrDeadline: NOW, fundingDeadline: NOW });
      expect(dueTradeEvent(t, NOW)?.event).toBe(
        status === "RofrPending" ? "LAPSE" : "BUYER_DEFAULT",
      );
      expect(dueTradeEvent(t, before)).toBeNull();
      expect(dueTradeEvent(makeTrade({ status }), NOW)).toBeNull();
    }
    expect(dueTradeEvent(makeTrade({ status: "Settled" }), NOW)).toBeNull();
  });
  it("settles listing close/expiry, completion and counter/bid expiry", () => {
    const l = settleListingDeadlines(
      deepFreeze(makeListing({ status: "Live" })),
      addDays(NOW, 30),
      { allTradesTerminal: false },
    );
    expect(l.applied.map((a) => a.event)).toEqual(["CLOSE_WINDOW", "EXPIRE"]);
    expect(l.listing.status).toBe("Expired");
    expect(
      settleListingDeadlines(deepFreeze(makeListing({ status: "Allocated" })), NOW, {
        allTradesTerminal: true,
      }).listing.status,
    ).toBe("Completed");
    const b = settleBidDeadlines(
      deepFreeze(
        makeBid({ status: "Countered", counterExpiresAt: NOW, expiresAt: addDays(NOW, 1) }),
      ),
      addDays(NOW, 30),
      makeListing(),
    );
    expect(b.applied.map((a) => a.event)).toEqual(["COUNTER_EXPIRE", "EXPIRE"]);
    expect(b.bid.status).toBe("Expired");
    expect(settleTradeDeadlines(deepFreeze(makeTrade()), NOW, makePolicy()).applied).toEqual([]);
  });
  it("caps a broken event loop at ten transitions", () => {
    let calls = 0;
    expect(() =>
      settleDeadlines(
        0,
        () => ({ kind: "listing", event: "COMPLETE", effectiveAt: NOW }),
        (n) => {
          calls++;
          return { next: n + 1, effects: [] };
        },
      ),
    ).toThrow("10 iterations");
    expect(calls).toBe(10);
  });
});
