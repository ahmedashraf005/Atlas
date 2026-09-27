import {
  deadlineTone,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyCompact,
  formatRelative,
  formatShares,
} from "@/lib/format";

export function formattingExamples(now: Date): [string, string][] {
  const at = (ms: number) => new Date(now.getTime() + ms);
  return [
    ['formatMoney(3850n, "AED", "perShare")', formatMoney(3850n, "AED", "perShare")],
    ['formatMoney(5n, "AED", "perShare")', formatMoney(5n, "AED", "perShare")],
    ['formatMoney(46200000n, "AED")', formatMoney(46200000n, "AED")],
    ['formatMoney(46200050n, "AED")', formatMoney(46200050n, "AED")],
    ['formatMoney(46200049n, "AED")', formatMoney(46200049n, "AED")],
    ['formatMoney(0n, "AED")', formatMoney(0n, "AED")],
    ['formatMoney(-120000n, "USD")', formatMoney(-120000n, "USD")],
    ['formatMoney(-120050n, "USD")', formatMoney(-120050n, "USD")],
    [
      'formatMoney(123456789012345678n, "AED", "perShare")',
      formatMoney(123456789012345678n, "AED", "perShare"),
    ],
    ...([40000000000n, 120000000000n, 125000000000n, 95000000n] as const).map(
      (minor): [string, string] => [
        `formatMoneyCompact(${minor}n, "AED")`,
        formatMoneyCompact(minor, "AED"),
      ],
    ),
    ['formatMoneyCompact(99900n, "USD")', formatMoneyCompact(99900n, "USD")],
    ['formatShares(12000n, "table")', formatShares(12000n, "table")],
    ['formatShares(12000n, "prose")', formatShares(12000n, "prose")],
    ['formatShares(1n, "prose")', formatShares(1n, "prose")],
    ['formatDate("2026-09-25T10:30:00Z")', formatDate(now)],
    ['formatDate("2026-09-25T21:30:00Z")', formatDate(new Date("2026-09-25T21:30:00Z"))],
    ['formatDateTime("2026-09-25T10:30:00Z")', formatDateTime(now)],
    ['formatDateTime("2026-01-05T20:05:00Z")', formatDateTime(new Date("2026-01-05T20:05:00Z"))],
    ...(
      [
        ["+5d 3h", 123 * 3600000],
        ["+20h 59m", 20 * 3600000 + 59 * 60000],
        ["+45m", 45 * 60000],
        ["+30s", 30000],
        ["now", 0],
        ["−2h", -2 * 3600000],
        ["−3d", -3 * 86400000],
        ["−10s", -10000],
      ] as const
    ).map(([label, ms]): [string, string] => [
      `formatRelative(${label}, now)`,
      formatRelative(at(ms), now),
    ]),
    ...([47, 48, 0] as const).map((hours): [string, string] => [
      `deadlineTone(+${hours}h, now)`,
      deadlineTone(at(hours * 3600000), now),
    ]),
  ];
}
