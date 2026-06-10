import type { ReactNode } from 'react';

import { create } from 'zustand';

type ModalEntry = {
  content: ReactNode;
  id: string;
  onClose?: () => void;
  preventClose?: boolean;
};

type ModalOptions = {
  id?: string;
  onClose?: () => void;
  preventClose?: boolean;
};

type ModalStore = {
  closeAllModals: () => void;
  closeModal: (id?: string) => void;
  modals: ModalEntry[];
  openModal: (content: ReactNode, options?: ModalOptions) => string;
};

let counter = 0;

const useModalStore = create<ModalStore>((set, get) => ({
  closeAllModals: () => {
    const modals = get().modals;
    for (const modal of modals) {
      modal.onClose?.();
    }
    set({ modals: [] });
  },
  closeModal: (id) => {
    const { modals } = get();
    if (modals.length === 0) return;

    if (id) {
      const target = modals.find((m) => m.id === id);
      if (target?.preventClose) return;
      target?.onClose?.();
      set({ modals: modals.filter((m) => m.id !== id) });
    } else {
      const top = modals[modals.length - 1];
      if (top.preventClose) return;
      top.onClose?.();
      set({ modals: modals.slice(0, -1) });
    }
  },
  modals: [],
  openModal: (content, options) => {
    const id = options?.id ?? `modal-${++counter}`;
    set((state) => ({
      modals: [
        ...state.modals,
        {
          content,
          id,
          onClose: options?.onClose,
          preventClose: options?.preventClose,
        },
      ],
    }));
    return id;
  },
}));

function useModal() {
  const closeAllModals = useModalStore((s) => s.closeAllModals);
  const closeModal = useModalStore((s) => s.closeModal);
  const openModal = useModalStore((s) => s.openModal);
  return { closeAllModals, closeModal, openModal };
}

export { useModal, useModalStore };
