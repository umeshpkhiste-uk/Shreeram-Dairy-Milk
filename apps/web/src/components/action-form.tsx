'use client';

import { useActionState, type ReactNode } from 'react';

import { ErrorText } from '@/components/ui';

type ActionState = { error: string | null };

/** A form on a server page whose action reports failure instead of crashing the page. */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, { error: null });
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <div className="mt-2">
          <ErrorText message={state.error} />
        </div>
      ) : null}
    </form>
  );
}
