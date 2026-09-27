import type { Allocation } from "@/domain/allocation";
export type EntityKind = "holding" | "listing" | "bid" | "trade";
export type NotifyRecipient = "seller" | "buyer" | "company" | "operator";
export type Effect =
  | {
      type: "AUDIT";
      entity: EntityKind;
      entityId: string;
      action: string;
      from: string;
      to: string;
    }
  | {
      type: "NOTIFY";
      recipient: NotifyRecipient;
      template: string;
      entity: EntityKind;
      entityId: string;
    }
  | { type: "RESERVE_SHARES"; holdingId: string; qty: bigint }
  | { type: "RELEASE_SHARES"; holdingId: string; qty: bigint }
  | { type: "MARK_SHARES_SOLD"; holdingId: string; qty: bigint }
  | { type: "REJECT_ACTIVE_BIDS"; listingId: string; reason: string }
  | { type: "CREATE_TRADES"; listingId: string; allocations: Allocation[] }
  | {
      type: "BACKUP_OR_RELEASE";
      listingId: string;
      holdingId: string;
      qty: bigint;
      backupBidId: string | null;
    }
  | {
      type: "TRANSFER_TO_BUYER";
      tradeId: string;
      buyerId: string;
      companyId: string;
      shareClassId: string;
      qty: bigint;
    }
  | { type: "ESCROW_RELEASE"; tradeId: string }
  | { type: "ESCROW_REFUND"; tradeId: string };
export const notify = (
  entity: EntityKind,
  entityId: string,
  recipient: NotifyRecipient,
  template: string,
): Effect => ({ type: "NOTIFY", recipient, template, entity, entityId });
