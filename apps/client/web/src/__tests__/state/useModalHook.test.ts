import { afterEach, describe, expect, it } from 'vitest';

import { useModalStore } from '../../state/useModal';

describe('useModalStore', () => {
  afterEach(() => {
    useModalStore.getState().closeAllModals();
  });

  it('opens a modal and returns an id', () => {
    const id = useModalStore.getState().openModal('test-content');
    expect(id).toBeTruthy();
    expect(useModalStore.getState().modals).toHaveLength(1);
  });

  it('closes a specific modal by id', () => {
    const id1 = useModalStore.getState().openModal('first');
    useModalStore.getState().openModal('second');
    useModalStore.getState().closeModal(id1);
    expect(useModalStore.getState().modals).toHaveLength(1);
    expect(useModalStore.getState().modals[0].content).toBe('second');
  });

  it('closeModal with no id closes the top modal', () => {
    useModalStore.getState().openModal('first');
    useModalStore.getState().openModal('second');
    useModalStore.getState().closeModal();
    expect(useModalStore.getState().modals).toHaveLength(1);
    expect(useModalStore.getState().modals[0].content).toBe('first');
  });

  it('closeAllModals empties the stack', () => {
    useModalStore.getState().openModal('a');
    useModalStore.getState().openModal('b');
    useModalStore.getState().closeAllModals();
    expect(useModalStore.getState().modals).toHaveLength(0);
  });

  it('respects custom id option', () => {
    useModalStore.getState().openModal('content', { id: 'custom-id' });
    expect(useModalStore.getState().modals[0].id).toBe('custom-id');
  });
});
