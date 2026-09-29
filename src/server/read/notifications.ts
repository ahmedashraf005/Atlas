import "server-only";
import { can } from "@/domain/authz";
import { formatRelative } from "@/lib/format";
import { notificationText } from "@/lib/notification-text";
import { type Database, getDb } from "@/server/db/client";
import * as companies from "@/server/repositories/companies";
import * as discovery from "@/server/repositories/discovery";
import * as notifications from "@/server/repositories/notifications";
import * as trades from "@/server/repositories/trades";
import type { Viewer } from "@/server/viewer";
export async function getNotificationsModel(viewer: Viewer, database?: Database) {
  const db = database ?? (await getDb());
  const [rows, companyRows, listingRows, visibleTrades] = await Promise.all([
    notifications.forRecipient(db, viewer.sandboxId, viewer.user.id),
    companies.list(db, viewer.sandboxId),
    discovery.publicListings(db, viewer.sandboxId),
    trades.visibleRows(db, viewer.sandboxId, viewer.actor),
  ]);
  const bidTargets = await notifications.bidTargets(
    db,
    viewer.sandboxId,
    viewer.user.id,
    rows
      .slice(0, 8)
      .filter((r) => r.entity === "bid")
      .map((r) => r.entityId),
  );
  return {
    unread: String(rows.filter((r) => !r.readAt).length),
    items: rows.slice(0, 8).map((row) => {
      const company = companyRows.find((c) => c.id === row.entityId);
      const listing = listingRows.find(
        (l) =>
          l.id === row.entityId ||
          bidTargets.some((b) => b.id === row.entityId && b.listingId === l.id),
      );
      const trade = visibleTrades.find((t) => t.id === row.entityId);
      const ref = company?.name ?? listing?.ref ?? trade?.ref ?? row.entity;
      const href = company
        ? `/companies/${company.slug}`
        : trade
          ? `/trades/${trade.id}`
          : row.entity === "bid" && viewer.user.role === "buyer"
            ? "/bids"
            : listing
              ? viewer.user.role === "operator" ||
                can(viewer.actor, "listing.viewReserve", {
                  kind: "listing",
                  sandboxId: viewer.sandboxId,
                  sellerId: listing.sellerId,
                  companyOrgId: "",
                  status: listing.status,
                }).allowed
                ? `/listings/${listing.id}`
                : `/companies/${companyRows.find((c) => c.id === listing.companyId)?.slug ?? "falaj-robotics"}`
              : row.entity === "holding" && viewer.user.role === "company_admin"
                ? "/company"
                : "/holdings";
      return {
        id: row.id,
        text: notificationText(row.template, ref, row.entity),
        relative: formatRelative(row.createdAt, viewer.now),
        unread: row.readAt === null,
        href,
      };
    }),
  };
}
export type NotificationsModel = Awaited<ReturnType<typeof getNotificationsModel>>;
