'use client';

import { useModalStore } from '@/state/useModal';
import * as Dialog from '@radix-ui/react-dialog';

import styles from './Modal.module.scss';

function ModalProvider() {
  const modals = useModalStore((s) => s.modals);
  const closeModal = useModalStore((s) => s.closeModal);

  return (
    <>
      {modals.map((modal, index) => (
        <Dialog.Root
          key={modal.id}
          open
          onOpenChange={(open) => {
            if (!open && !modal.preventClose) {
              closeModal(modal.id);
            }
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay
              className={styles.overlay}
              style={{ zIndex: 1000 + index }}
            />
            <Dialog.Content
              aria-describedby={undefined}
              className={styles.content}
              onEscapeKeyDown={(e) => {
                if (modal.preventClose) e.preventDefault();
              }}
              onPointerDownOutside={(e) => {
                if (modal.preventClose) e.preventDefault();
              }}
              style={{ zIndex: 1001 + index }}
            >
              <Dialog.Title className={styles.srOnly}>Dialog</Dialog.Title>
              {modal.content}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ))}
    </>
  );
}

ModalProvider.displayName = 'ModalProvider';

export { ModalProvider };
