import { afterEach, describe, expect, it } from 'vitest';

import { useThemeStore } from '../../state/useTheme';

describe('useThemeStore', () => {
  afterEach(() => {
    useThemeStore.getState().setTheme('system');
    delete document.documentElement.dataset.theme;
  });

  it('defaults to system', () => {
    expect(useThemeStore.getState().theme).toBe('system');
  });

  it('setTheme updates the store', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
