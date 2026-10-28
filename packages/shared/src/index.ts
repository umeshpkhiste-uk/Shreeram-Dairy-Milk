// Shared, framework-agnostic types and pure logic used by both apps/mobile and
// apps/web — see docs/architecture.md and docs/web-admin.md. Everything here
// is plain TypeScript with no React Native or Next.js dependency, so it can
// be imported directly from either app without a build step.

export * from './types/database';
export * from './lib/money';
export * from './lib/quantity';
export * from './lib/date';
export * from './lib/csv';
export * from './lib/billing/status';
export * from './lib/validation/customer';
export * from './lib/validation/bill';
export * from './lib/validation/payment';
export * from './lib/dashboard/metrics';
export * from './lib/pdf/bill-template';
