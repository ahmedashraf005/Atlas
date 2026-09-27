import { expect, it } from "vitest";
import * as c from "@/domain/constants";

it("locks the business constants", () =>
  expect(c).toMatchObject({
    COUNTER_RESPONSE_HOURS: 48,
    MAX_COUNTERS_PER_LISTING: 3,
    DECISION_DAYS_AFTER_WINDOW: 7,
    BID_VALIDITY_DAYS_AFTER_WINDOW: 14,
    BAND_LOOKBACK_DAYS: 180,
    BAND_MIN_TRADES: 3,
    BID_WINDOW_DAY_OPTIONS: [3, 5, 7],
    DEFAULT_BID_WINDOW_DAYS: 5,
    MAX_RATIONALE_LENGTH: 500,
    MAX_DISPUTE_REASON_LENGTH: 1000,
    GENESIS_HASH: "0".repeat(64),
  }));
