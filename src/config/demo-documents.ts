export type DemoDocument =
  | { kind: "financials"; intro: string; rows: string[][] }
  | { kind: "cap_table"; intro: string }
  | { kind: "clauses"; intro: string };
export const DEMO_DOCUMENTS: Record<string, DemoDocument> = {
  "demo/falaj/fy2025-audited-financials.pdf": {
    kind: "financials",
    intro: "A fictional summary of Falaj Robotics' audited financial performance.",
    rows: [
      ["Revenue", "AED 38.2M", "AED 24.9M"],
      ["Gross margin", "41%", "36%"],
      ["EBITDA", "−AED 6.1M", "−AED 9.4M"],
      ["Cash at year end", "AED 52.4M", "AED 31.0M"],
      ["Employees", "146", "112"],
    ],
  },
  "demo/falaj/cap-table-summary.pdf": {
    kind: "cap_table",
    intro: "Fully diluted share classes at the latest round.",
  },
  "demo/falaj/transfer-clauses.pdf": {
    kind: "clauses",
    intro: "Plain-language summary of the company's transfer policy.",
  },
};
