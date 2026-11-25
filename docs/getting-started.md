# Getting started

## Prerequisites

- Node.js 20+ and npm
- Access to the project's [Supabase](https://supabase.com) project

## Setup

```bash
npm install    # repo root
```

Create `.env.local` in `apps/web` and `apps/worker-web` with the two values described in
[`docs/environment-variables.md`](environment-variables.md). **Never commit real values.**

```bash
npm run dev -w web           # http://localhost:3000
npm run dev -w worker-web    # http://localhost:3001, service worker off
```

To run the worker app with its service worker, use `npm run build -w worker-web` and then
`npm run start -w worker-web`.

## Checks

```bash
# in apps/web
npx tsc --noEmit && npm run lint && npm run build
# in apps/worker-web
npm run typecheck && npm run lint && npm test && npm run build
# in packages/shared
npm run typecheck && npm test
```

## Database

Migrations are in `supabase/migrations`. Commands are in
[`docs/environment-variables.md`](environment-variables.md), the schema in
[`docs/database-schema.md`](database-schema.md).
