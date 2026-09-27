import { expect, it } from "vitest";
import { redactMessage } from "@/domain/redact";

it.each([
  ["Email me at sara@example.com", "Email me at [email removed]", "email"],
  ["Call +971 50 123 4567 tonight", "Call [phone removed] tonight", "phone"],
  ["050-123-4567", "[phone removed]", "phone"],
  ["call 0501234567", "call [phone removed]", "phone"],
  ["see www.example.com", "see [link removed]", "url"],
  ["https://x.io/a?b=1", "[link removed]", "url"],
  ["AED 462,000 for 12,000 shares", "AED 462,000 for 12,000 shares", null],
  ["Bid at 35.50 per share", "Bid at 35.50 per share", null],
  ["Series B in 2026, ROFR 30 days", "Series B in 2026, ROFR 30 days", null],
  ["Ref T-1042 on 25 Sep 2026", "Ref T-1042 on 25 Sep 2026", null],
  ["example.com/path", "[link removed]", "url"],
  ["Call +971 (50) 123 4567.", "Call [phone removed].", "phone"],
  ["123456789", "[phone removed]", "phone"],
  ["123456789012345", "[phone removed]", "phone"],
  ["12345678", "12345678", null],
  ["1234567890123456", "1234567890123456", null],
  ["Visit https://x.io/0501234567, tonight.", "Visit [link removed], tonight.", "url"],
])("redacts %s", (input, output, kind) =>
  expect(redactMessage(input as string)).toEqual({
    text: output,
    flagged: kind !== null,
    found: kind ? [kind] : [],
  }));
it("lists unique kinds in first-appearance order, respects URL/email overlaps and punctuation", () => {
  expect(redactMessage("www.x.io sara@example.com +971501234567 sara@example.com")).toEqual({
    text: "[link removed] [email removed] [phone removed] [email removed]",
    flagged: true,
    found: ["url", "email", "phone"],
  });
  expect(redactMessage("Mail sara@example.com/path")).toEqual({
    text: "Mail [email removed]/path",
    flagged: true,
    found: ["email"],
  });
  expect(redactMessage("See (https://x.io/a).")).toEqual({
    text: "See ([link removed]).",
    flagged: true,
    found: ["url"],
  });
  expect(redactMessage("")).toEqual({ text: "", flagged: false, found: [] });
});
