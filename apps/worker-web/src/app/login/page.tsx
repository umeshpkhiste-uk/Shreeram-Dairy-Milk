import { Suspense } from 'react';

import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static public asset, no optimization needed */}
          <img
            src="/icon-512.png"
            alt=""
            width={112}
            height={112}
            className="mb-4 h-28 w-28 rounded-full object-contain"
          />
          <h1 className="text-xl font-semibold text-text">Shreeram Doodh Diary &amp; Sweets</h1>
          <p className="mt-3 text-sm font-medium text-text">Worker sign in</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
