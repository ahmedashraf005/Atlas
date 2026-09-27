# Atlas

Atlas is a fictional marketplace demo built for an interview task. Shareholders offer existing shares in private UAE startups to professional investors, with company approval for every transfer. Segment 0 provides the design system, app shell, placeholder routes, and test harness.

Requires Node.js 24 and pnpm 11.15.1. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. No database or session credentials are needed for this segment. `/dev/ui` is available in development; production requires `ATLAS_DEV_UI=1` (for testing only, never set on Vercel).

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server at http://localhost:3000 |
| `pnpm build` / `pnpm start` | Production build / serve |
| `pnpm typecheck` | TypeScript checks |
| `pnpm lint` / `pnpm lint:fix` | Biome checks / formatting and safe fixes |
| `pnpm test` / `pnpm test:watch` | Unit and component tests / watch |
| `pnpm test:e2e` | Playwright against a production build on port 3100 |
| `pnpm tokens` | Generate Atlas token CSS |
| `pnpm tokens:check` | Check generated CSS is current |
| `pnpm check` | Tokens, types, lint, tests, production build |

Before the first browser test run: `pnpm exec playwright install chromium`. Database commands arrive in segment 2.

Contributors and AI agents: read AGENTS.md first.
