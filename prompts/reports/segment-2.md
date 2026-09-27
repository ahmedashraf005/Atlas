# Segment 2 report

## Result

Blocked before implementation: the repository is at `/Users/ahmedashraf/Desktop/atlas`, which violates Segment 2's required non-synced working location.

## Acceptance criteria

- [x] Read `AGENTS.md`, the Segment 0 and Segment 1 reports, and `docs/design/README.md`.
- [ ] 1. Schema, migrations, constraints and drift check — not started because the location prerequisite failed.
- [ ] 2. Sessions, isolated seed, concurrency and purge — not started.
- [ ] 3. Action pipeline, transitions, effects and trusted audit head — not started.
- [ ] 4. Deadlines, auto-pilot and polling — not started.
- [ ] 5. Demo toolbar controls — not started.
- [ ] 6. Full checks, integration/unit/guard/E2E tests and server coverage — not run; the explicit location stop rule applies before baseline checks.
- [ ] 7. Database smoke tests — not run against PGlite or Neon.
- [ ] 8. Implementation disclosures — no seed names introduced, Neon pool approach selected, job handlers registered, or schema decisions made. This report records the prerequisite block.

## Commands run

| Command | Result |
| --- | --- |
| `pwd` | `/Users/ahmedashraf/Desktop/atlas`; forbidden by the segment prerequisite |
| `cat AGENTS.md prompts/reports/segment-0.md prompts/reports/segment-1.md` | Read instructions and prior reports; re-read Segment 0 separately after combined output truncation |
| `cat prompts/reports/segment-0.md docs/design/README.md` | Read complete Segment 0 report and design guidance |
| `git status --short -- prompts/reports/segment-2.md` | No existing report changes shown before writing |

## Decisions and deviations

- Followed the explicit instruction: "If the current path is inside ~/Desktop, ~/Documents or ~/Library/Mobile Documents, stop and report instead of working around it."
- Did not move or mirror the repository, install dependencies, change application code, or run builds/tests from the forbidden location.
- Segment 2's specific stop rule takes precedence over the general requirement to finish with checks. No passing baseline or completed implementation is claimed.
- No commits, pushes, branches or PRs were created.

## Skipped or deferred

- All Segment 2 implementation and verification is deferred until the workspace is opened from a non-synced location such as `~/dev/atlas`. No new code TODOs were introduced.

## Files created or changed

- `prompts/reports/segment-2.md` — prerequisite failure and handoff report only.

## For Ahmed to check manually

- Relocate the complete working repository, preserving existing uncommitted changes, to a non-synced folder such as `~/dev/atlas`, and open that location as the workspace.
- Resume Segment 2 there; first run `pnpm check` and `pnpm test:e2e` and stop if either fails, as required by the segment prompt.
