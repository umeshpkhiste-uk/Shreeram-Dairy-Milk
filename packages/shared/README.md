# @shreeram/shared

TypeScript types, validation schemas and non-sensitive business logic used by both `apps/web`
and `apps/worker-web`.

Per the architecture rule in [`docs/architecture.md`](../../docs/architecture.md): sensitive
billing or authorization logic is never duplicated across apps — it lives here or server-side,
not copy-pasted into each app.
