'use client';

import { useActionState } from 'react';

import { signIn } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState(signIn, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Email
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-text">
        Password
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-border bg-surface px-3 py-2 text-base text-text outline-none focus:border-primary"
        />
      </label>

      {state.error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-text-on-primary transition hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
