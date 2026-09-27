export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <rect width="22" height="22" rx="4" className="fill-atlas-green" />
        <path d="M5 9.5H17M5 13.5H17" strokeWidth="1.5" className="stroke-on-green" />
      </svg>
      <span className={withWordmark ? "type-heading-2" : "sr-only"}>Atlas</span>
    </span>
  );
}
