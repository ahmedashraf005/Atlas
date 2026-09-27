import fc from "fast-check";
import { expect, it } from "vitest";
import { bidVsBand, fairValueBand, fallbackPriceForClass, waterfall } from "@/domain/pricing";
import { addDays } from "@/domain/time";
import { CLASSES, deepFreeze, makeClass, makeCompany, NOW } from "./helpers/fixtures";

const trade = (priceMinor: bigint, quantity: bigint, days: number, relatedParty = false) => ({
  priceMinor,
  quantity,
  executedAt: addDays(NOW, -days),
  relatedParty,
});
it("computes the specified size-weighted band and excludes related/old/future trades", () => {
  expect(
    fairValueBand({
      now: NOW,
      fallbackMinor: 1n,
      trades: deepFreeze([
        trade(3260n, 500n, 10),
        trade(3420n, 1000n, 20),
        trade(3500n, 2000n, 30),
        trade(3580n, 4000n, 40),
        trade(3610n, 1500n, 50),
        trade(3810n, 1000n, 60),
        trade(2000n, 5000n, 5, true),
        trade(4500n, 5000n, 200),
        trade(99999n, 10n, -1),
      ]),
    }),
  ).toEqual({
    method: "trades",
    lowMinor: 3500n,
    midMinor: 3580n,
    highMinor: 3580n,
    tradeCount: 6,
  });
});
it("includes exact lookback and current boundaries, resolves ties, and falls back", () => {
  const trades = [trade(10n, 1n, 180), trade(10n, 1n, 0), trade(30n, 1n, 1), trade(10n, 1n, 0)];
  expect(fairValueBand({ trades, now: NOW, fallbackMinor: null })).toEqual({
    method: "trades",
    lowMinor: 10n,
    midMinor: 10n,
    highMinor: 10n,
    tradeCount: 4,
  });
  expect(fairValueBand({ trades: [], now: NOW, fallbackMinor: 0n })).toEqual({
    method: "waterfall",
    lowMinor: 0n,
    midMinor: 0n,
    highMinor: 0n,
  });
  expect(fairValueBand({ trades: [trade(1n, 1n, 181)], now: NOW, fallbackMinor: null })).toEqual({
    method: "none",
  });
  expect(() =>
    fairValueBand({ trades: [trade(1n, 0n, 0)], now: NOW, fallbackMinor: null }),
  ).toThrow();
  expect(() =>
    fairValueBand({ trades: [trade(-1n, 1n, 0)], now: NOW, fallbackMinor: null }),
  ).toThrow();
});
it.each([
  [
    40_000_000_000n,
    { B: 8_400_000_000n, A: 10_533_333_333n, ordinary: 21_066_666_667n },
    { B: 4200n, A: 3511n, ordinary: 3511n },
  ],
  [5_000_000_000n, { B: 5_000_000_000n, A: 0n, ordinary: 0n }, { B: 2500n, A: 0n, ordinary: 0n }],
  [0n, { B: 0n, A: 0n, ordinary: 0n }, { B: 0n, A: 0n, ordinary: 0n }],
])("runs the required waterfall at %s", (exitValueMinor, payoutMinor, perShareMinor) =>
  expect(
    waterfall({ exitValueMinor: exitValueMinor as bigint, classes: deepFreeze([...CLASSES]) }),
  ).toEqual({ payoutMinor, perShareMinor }));
it("assigns ordinary residue, supports all-preferred and missing fallback paths", () => {
  expect(
    waterfall({
      exitValueMinor: 5n,
      classes: [makeClass({ id: "a", shares: 3n }), makeClass({ id: "b", shares: 3n })],
    }).payoutMinor,
  ).toEqual({ a: 2n, b: 3n });
  expect(
    waterfall({ exitValueMinor: 7n, classes: [makeClass({ kind: "preferred", shares: 3n })] })
      .payoutMinor.ordinary,
  ).toBe(7n);
  expect(waterfall({ exitValueMinor: 0n, classes: [] })).toEqual({
    payoutMinor: {},
    perShareMinor: {},
  });
  expect(
    fallbackPriceForClass({ company: makeCompany(), classes: CLASSES, shareClassId: "ordinary" }),
  ).toBe(3511n);
  expect(
    fallbackPriceForClass({
      company: makeCompany({ lastRoundPostMoneyMinor: null }),
      classes: CLASSES,
      shareClassId: "ordinary",
    }),
  ).toBeNull();
  expect(
    fallbackPriceForClass({ company: makeCompany(), classes: CLASSES, shareClassId: "missing" }),
  ).toBeNull();
});
it("rejects invalid waterfall inputs", () => {
  for (const input of [
    { exitValueMinor: -1n, classes: CLASSES },
    { exitValueMinor: 1n, classes: [] },
    { exitValueMinor: 1n, classes: [makeClass({ shares: 0n })] },
    { exitValueMinor: 1n, classes: [makeClass({ originalPriceMinor: -1n })] },
    { exitValueMinor: 1n, classes: [makeClass({ prefMultipleBps: 0.5 })] },
    { exitValueMinor: 1n, classes: [makeClass({ prefMultipleBps: -1 })] },
    { exitValueMinor: 1n, classes: [makeClass(), makeClass()] },
  ])
    expect(() => waterfall(input)).toThrow();
});
it("compares bids to inclusive band boundaries", () => {
  const band = { method: "waterfall" as const, lowMinor: 10n, midMinor: 15n, highMinor: 20n };
  expect([9n, 10n, 15n, 20n, 21n].map((p) => bidVsBand(p, band))).toEqual([
    "below",
    "within",
    "within",
    "within",
    "above",
  ]);
  expect(bidVsBand(1n, { method: "none" })).toBe("unknown");
});
it("weighted percentiles are ordered eligible prices", () =>
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          price: fc.bigInt({ min: 1n, max: 100000n }),
          qty: fc.bigInt({ min: 1n, max: 100000n }),
          days: fc.integer({ min: 0, max: 180 }),
        }),
        { minLength: 3, maxLength: 30 },
      ),
      (values) => {
        const trades = values.map((v) => trade(v.price, v.qty, v.days)),
          band = fairValueBand({ trades, now: NOW, fallbackMinor: null });
        if (band.method !== "trades") throw new Error("Expected trades.");
        expect(band.lowMinor).toBeLessThanOrEqual(band.midMinor);
        expect(band.midMinor).toBeLessThanOrEqual(band.highMinor);
        for (const price of [band.lowMinor, band.midMinor, band.highMinor])
          expect(trades.some((t) => t.priceMinor === price)).toBe(true);
      },
    ),
    { numRuns: 200 },
  ));
it("waterfall conserves every minor unit with non-negative payouts", () =>
  fc.assert(
    fc.property(
      fc.bigInt({ min: 0n, max: 10n ** 20n }),
      fc.array(fc.bigInt({ min: 1n, max: 1000000n }), { minLength: 1, maxLength: 8 }),
      (exit, shares) => {
        const classes = shares.map((qty, index) =>
          makeClass({
            id: String(index),
            shares: qty,
            kind: index === shares.length - 1 ? "ordinary" : "preferred",
            seniority: index + 1,
            originalPriceMinor: 1200n,
            prefMultipleBps: 10000,
          }),
        );
        const r = waterfall({ exitValueMinor: exit, classes: deepFreeze(classes) });
        expect(Object.values(r.payoutMinor).reduce((a, b) => a + b, 0n)).toBe(exit);
        for (const value of Object.values(r.payoutMinor)) expect(value).toBeGreaterThanOrEqual(0n);
      },
    ),
    { numRuns: 200 },
  ));
