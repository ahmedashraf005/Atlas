import { formatDate, formatDateTime } from "@/lib/format";

export function DateText({ date, withTime = false }: { date: Date | string; withTime?: boolean }) {
  const instant = new Date(date);
  return (
    <time dateTime={instant.toISOString()}>
      {withTime ? formatDateTime(instant) : formatDate(instant)}
    </time>
  );
}
