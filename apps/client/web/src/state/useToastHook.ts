import { create } from 'zustand';

type ToastType = 'error' | 'info' | 'success';

type ToastEntry = {
  duration: number;
  id: string;
  message: string;
  type: ToastType;
};

type ToastStore = {
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  clearAll: () => void;
  removeToast: (id: string) => void;
  toasts: ToastEntry[];
};

let counter = 0;

const useToastStore = create<ToastStore>((set) => ({
  addToast: (message, type = 'info', duration = 5000) => {
    const id = `toast-${++counter}`;
    set((state) => ({
      toasts: [...state.toasts, { duration, id, message, type }],
    }));
    return id;
  },
  clearAll: () => set({ toasts: [] }),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  toasts: [],
}));

export { useToastStore };
export type { ToastEntry, ToastType };
