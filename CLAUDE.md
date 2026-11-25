# Shreeram Daily Milk — repo notes for Claude

Monorepo for a dairy delivery management system. Full architecture rules, stack, and
non-negotiables: [`docs/architecture.md`](docs/architecture.md). Current stage and what's
done vs. pending: [`docs/roadmap.md`](docs/roadmap.md). Original product brief and
per-stage implementation checklist: [`docs/reference/`](docs/reference/).

## Working in this repo

- Build in the stage order defined in `docs/roadmap.md`. Don't jump ahead to a later
  stage's feature (e.g. don't wire up billing before offline sync is tested) unless the
  user explicitly asks.
- Two web apps only: `apps/web` (admin) and `apps/worker-web` (workers, Chrome on Android).
  The old mobile app was removed on 2026-11-25; don't bring it back. Each app has its own
  `AGENTS.md` — read it before touching that app.
- Never put a privileged key (Supabase service role, etc.) in `apps/web` or
  `apps/worker-web` — only `NEXT_PUBLIC_*` values, which are still constrained by
  Row-Level Security server-side. See `docs/environment-variables.md`.
- Money: fixed-precision, never floating point. Delivery quantities: integer millilitres
  (grams for products sold by the kg) internally, never floating point.
- After finishing a stage: run lint, typecheck, and tests for whatever was touched; report
  what actually passed, not what should pass. Don't mark a stage done with failing checks
  or placeholder data presented as real.
- Ask before starting the next stage — the user reviews each stage before the next begins.
