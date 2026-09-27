type Kind = "email" | "phone" | "url";
export function redactMessage(text: string): { text: string; flagged: boolean; found: Kind[] } {
  const patterns: { kind: Kind; expression: RegExp; replacement: string }[] = [
    {
      kind: "email",
      expression:
        /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi,
      replacement: "[email removed]",
    },
    {
      kind: "url",
      expression:
        /(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\/[^\s<>"']*/gi,
      replacement: "[link removed]",
    },
    {
      kind: "phone",
      expression: /(?<![\w+])\+?(?:\(\d+\)|\d+)(?:[ .-]?(?:\(\d+\)|\d+))*(?!\w)/g,
      replacement: "[phone removed]",
    },
  ];
  const candidates = patterns
    .flatMap((p) =>
      Array.from(text.matchAll(p.expression), (m) => ({
        kind: p.kind,
        start: m.index,
        end: m.index + m[0].length,
        value: m[0],
        replacement: p.replacement,
      })),
    )
    .filter(
      (m) =>
        m.kind !== "phone" ||
        (m.value.replace(/\D/g, "").length >= 9 && m.value.replace(/\D/g, "").length <= 15),
    );
  candidates.sort(
    (a, b) =>
      a.start - b.start || (a.kind === "email" ? -1 : b.kind === "email" ? 1 : b.end - a.end),
  );
  const found: Kind[] = [];
  let cursor = 0,
    result = "";
  for (const m of candidates) {
    if (m.start < cursor) continue;
    let end = m.end;
    if (m.kind === "url") while (end > m.start && /[.,;!?)]/.test(text[end - 1] ?? "")) end--;
    result += text.slice(cursor, m.start) + m.replacement;
    cursor = end;
    if (!found.includes(m.kind)) found.push(m.kind);
  }
  result += text.slice(cursor);
  return { text: result, flagged: found.length > 0, found };
}
