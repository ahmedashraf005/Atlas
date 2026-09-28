export function Watermark({ text }: { text: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex -rotate-24 select-none flex-col items-center justify-around overflow-hidden type-label text-ink-muted opacity-15"
    >
      {["one", "two", "three", "four", "five", "six"].map((id) => (
        <p key={id} className="whitespace-nowrap">
          {text} · {text}
        </p>
      ))}
    </div>
  );
}
