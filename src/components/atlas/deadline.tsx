import { deadlineTone, formatDate, formatRelative } from "@/lib/format";

const tones = {
  neutral: "text-ink-muted",
  warning: "text-warning font-medium",
  danger: "text-danger font-medium",
};
export function Deadline({
  at,
  now,
  prefix,
}: {
  at: Date | string;
  now: Date | string;
  prefix?: string;
}) {
  const target = new Date(at);
  const current = new Date(now);
  const tone = deadlineTone(target, current);
  return (
    <span>
      {prefix ? `${prefix} ` : null}
      <time dateTime={target.toISOString()}>{formatDate(target)}</time>
      {" · "}
      <span className={tones[tone]} data-tone={tone}>
        {formatRelative(target, current)}
      </span>
    </span>
  );
}
