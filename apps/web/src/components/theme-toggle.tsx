'use client';

import { useSyncExternalStore } from 'react';

import { Icon } from './icon';

type Theme = 'light' | 'dark';

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// The inline script in app/layout.tsx sets this attribute before first paint.
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Storage blocked — the choice just lasts until the page is reloaded.
  }
  listeners.forEach((listener) => listener());
}

const SunIcon = (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
);
const MoonIcon = (
  <Icon>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Icon>
);

export function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => 'light');

  if (collapsed) {
    const next = theme === 'dark' ? 'light' : 'dark';
    return (
      <button
        type="button"
        aria-label={`Switch to ${next} mode`}
        title={`Switch to ${next} mode`}
        onClick={() => setTheme(next)}
        className="flex justify-center rounded-lg bg-surface-muted py-2 text-text-secondary transition hover:text-text"
      >
        {theme === 'dark' ? MoonIcon : SunIcon}
      </button>
    );
  }

  return (
    <div role="group" aria-label="Colour theme" className="flex rounded-lg bg-surface-muted p-1">
      {(['light', 'dark'] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={theme === option}
          onClick={() => setTheme(option)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition ${
            theme === option ? 'bg-surface text-text shadow-sm' : 'text-text-secondary hover:text-text'
          }`}
        >
          {option === 'light' ? SunIcon : MoonIcon}
          {option === 'light' ? 'Light' : 'Dark'}
        </button>
      ))}
    </div>
  );
}
