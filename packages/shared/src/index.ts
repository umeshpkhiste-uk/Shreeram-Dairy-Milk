// Shared, framework-agnostic types and pure logic used by both apps/web and
// apps/worker-web — see docs/architecture.md and docs/web-admin.md. Everything here
// is plain TypeScript with no Next.js dependency, so it can
// be imported directly from either app without a build step.

export * from './types/database';
export * from './lib/money';
export * from './lib/quantity';
export * from './lib/products';
export * from './lib/date';
export * from './lib/errors';
export * from './lib/billing/status';
export * from './lib/validation/customer';
export * from './lib/validation/bill';
export * from './lib/validation/payment';
export * from './lib/validation/delivery';
export * from './lib/dashboard/metrics';
export * from './lib/pdf/bill-template';
export * from './lib/pdf/order-receipt-template';
