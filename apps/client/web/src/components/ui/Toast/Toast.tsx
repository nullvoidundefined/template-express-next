'use client';

import { useEffect } from 'react';

import { useToastStore } from '@/state/useToast';
import * as RadixToast from '@radix-ui/react-toast';

import styles from './Toast.module.scss';

function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <RadixToast.Provider swipeDirection='right'>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          duration={toast.duration}
          message={toast.message}
          onClose={() => removeToast(toast.id)}
          type={toast.type}
        />
      ))}
      <RadixToast.Viewport className={styles.viewport} />
    </RadixToast.Provider>
  );
}

type ToastItemProps = {
  duration: number;
  message: string;
  onClose: () => void;
  type: string;
};

function ToastItem({ duration, message, onClose, type }: ToastItemProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <RadixToast.Root
      className={`${styles.root} ${styles[type] ?? ''}`}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <RadixToast.Description>{message}</RadixToast.Description>
      <RadixToast.Close aria-label='Dismiss' className={styles.close}>
        &times;
      </RadixToast.Close>
    </RadixToast.Root>
  );
}

ToastViewport.displayName = 'ToastViewport';
ToastItem.displayName = 'ToastItem';

export { ToastViewport };
