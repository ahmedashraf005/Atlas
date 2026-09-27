import { type Currency, formatMoney, formatShares } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({
  minor,
  currency,
  mode,
  className,
}: {
  minor: bigint | string;
  currency: Currency;
  mode?: "perShare" | "total";
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {formatMoney(BigInt(minor), currency, mode)}
    </span>
  );
}
export function Shares({
  qty,
  style,
  className,
}: {
  qty: bigint | string;
  style: "table" | "prose";
  className?: string;
}) {
  return <span className={cn("tabular-nums", className)}>{formatShares(BigInt(qty), style)}</span>;
}
