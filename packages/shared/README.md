# @shreeram/shared (reserved)

Shared TypeScript types, validation schemas, and non-sensitive business utilities used by
both `apps/mobile` and the future `apps/web`. Intentionally empty until Stage 2 introduces
the first types worth sharing (e.g. database row types generated from the Supabase schema).

Per the architecture rule in [`docs/architecture.md`](../../docs/architecture.md): sensitive
billing or authorization logic is never duplicated independently across platforms — it
lives here or server-side, not copy-pasted into each app.
