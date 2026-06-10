import { afterEach, describe, expect, it } from 'vitest';

import { useToastStore } from '../../state/useToast';

describe('useToastStore', () => {
  afterEach(() => {
    useToastStore.getState().clearAll();
  });

  it('adds a toast and returns an id', () => {
    const id = useToastStore.getState().addToast('Hello');
    expect(id).toBeTruthy();
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0].message).toBe('Hello');
  });

  it('removes a toast by id', () => {
    const id = useToastStore.getState().addToast('Remove me');
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('supports type parameter', () => {
    useToastStore.getState().addToast('Error!', 'error');
    expect(useToastStore.getState().toasts[0].type).toBe('error');
  });
});
