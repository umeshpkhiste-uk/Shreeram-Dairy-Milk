import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { signOut } from './actions';
import { LoginForm } from './login-form';

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { next, error } = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (userData.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active, full_name')
      .eq('id', userData.user.id)
      .single();

    if (profile?.role === 'admin' && profile.is_active) {
      redirect(next && next.startsWith('/') ? next : '/');
    }

    // Signed in, but not an authorized admin (a worker account, or a
    // deactivated admin) — never bounce back into the admin area.
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
        <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
          <h1 className="mb-2 text-xl font-semibold text-text">Not authorized</h1>
          <p className="mb-6 text-sm text-text-secondary">
            {profile?.full_name ? `${profile.full_name}, ` : ''}this account doesn&rsquo;t have
            admin access to the Shreeram Daily Milk website. Sign out and sign in with an admin
            account, or contact the business owner.
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md border border-border px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-muted"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-text">Shreeram Daily Milk</h1>
        <p className="mb-6 text-sm text-text-secondary">Admin sign in</p>
        {error === 'not-authorized' ? (
          <p className="mb-4 rounded-md bg-warning-bg px-3 py-2 text-sm text-warning">
            That account doesn&rsquo;t have admin access.
          </p>
        ) : null}
        <LoginForm next={next && next.startsWith('/') ? next : '/'} />
      </div>
    </div>
  );
}
