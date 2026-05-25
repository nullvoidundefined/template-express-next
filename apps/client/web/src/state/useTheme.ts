'use client';

import { create } from 'zustand';

type ThemeMode = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'app-theme';

function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyToDOM(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(mode);
  if (resolved === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  } else {
    delete document.documentElement.dataset.theme;
  }
}

type ThemeStore = {
  setTheme: (mode: ThemeMode) => void;
  theme: ThemeMode;
};

const useThemeStore = create<ThemeStore>((set) => ({
  setTheme: (mode) => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage may be unavailable.
    }
    applyToDOM(mode);
    set({ theme: mode });
  },
  theme: (() => {
    if (typeof window === 'undefined') return 'system';
    try {
      return (
        (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system'
      );
    } catch {
      return 'system';
    }
  })(),
}));

// Listen for system preference changes when in system mode.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') {
      applyToDOM('system');
    }
  });

  // Apply on initial load.
  applyToDOM(useThemeStore.getState().theme);
}

export { useThemeStore };
export type { ThemeMode };
