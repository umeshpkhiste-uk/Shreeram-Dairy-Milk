import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';

import { env } from '@/lib/env';
import type { Database } from '@/types/database';

import { LargeSecureStore } from './large-secure-store';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's auto-refresh timer only ticks while something calls
// startAutoRefresh()/stopAutoRefresh() around app foreground state —
// without this, a session can expire while the app is backgrounded and not
// refresh until the next explicit auth call.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
