export type Currency = "AED" | "USD";

const absolute = (value: bigint) => (value < 0n ? -value : value);
const group = (value: bigint) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const rounded = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor;

export function formatMoney(
  minor: bigint,
  currency: Currency,
  mode: "perShare" | "total" = "total",
): string {
  const magnitude = absolute(minor);
  const amount =
    mode === "perShare"
      ? `${group(magnitude / 100n)}.${(magnitude % 100n).toString().padStart(2, "0")}`
      : group(rounded(magnitude, 100n));
  return `${minor < 0n ? "-" : ""}${currency} ${amount}`;
}

export function formatMoneyCompact(minor: bigint, currency: Currency): string {
  const whole = rounded(absolute(minor), 100n);
  const tier =
    whole >= 1_000_000_000n
      ? ([1_000_000_000n, "B"] as const)
      : whole >= 1_000_000n
        ? ([1_000_000n, "M"] as const)
        : whole >= 1_000n
          ? ([1_000n, "K"] as const)
          : undefined;
  let amount = group(whole);
  if (tier) {
    const tenths = rounded(whole * 10n, tier[0]);
    amount = `${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ""}${tier[1]}`;
  }
  return `${minor < 0n ? "-" : ""}${currency} ${amount}`;
}

export function formatShares(qty: bigint, style: "table" | "prose"): string {
  return `${group(qty)} ${style === "table" ? "sh" : qty === 1n ? "share" : "shares"}`;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  day: "numeric",
  month: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatDate(d: Date): string {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(d).map((part) => [part.type, part.value]),
  );
  return `${Number(parts.day)} ${months[Number(parts.month) - 1]} ${parts.year}`;
}

export function formatDateTime(d: Date): string {
  const parts = Object.fromEntries(
    timeFormatter.formatToParts(d).map((part) => [part.type, part.value]),
  );
  return `${formatDate(d)}, ${parts.hour}:${parts.minute} GST`;
}

export function formatRelative(target: Date, now: Date): string {
  const diff = target.getTime() - now.getTime();
  if (diff === 0) return "now";
  const duration = Math.abs(diff);
  if (duration < 60_000) return diff > 0 ? "in under a minute" : "just now";
  const label =
    duration >= 172_800_000
      ? `${Math.floor(duration / 86_400_000)} days`
      : duration >= 3_600_000
        ? `${Math.floor(duration / 3_600_000)}h`
        : `${Math.floor(duration / 60_000)} min`;
  return diff > 0 ? `in ${label}` : `${label} ago`;
}

export function deadlineTone(target: Date, now: Date): "neutral" | "warning" | "danger" {
  const diff = target.getTime() - now.getTime();
  return diff <= 0 ? "danger" : diff < 172_800_000 ? "warning" : "neutral";
}
