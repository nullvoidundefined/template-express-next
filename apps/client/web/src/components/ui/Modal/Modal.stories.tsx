import type { Meta, StoryObj } from '@storybook/react-vite';

import { useModalStore } from '../../../state/useModal';
import { ModalProvider } from './Modal';

const meta: Meta = {
  component: ModalProvider,
  title: 'UI/Modal',
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const openModal = useModalStore((s) => s.openModal);
    return (
      <div>
        <button
          onClick={() =>
            openModal(
              <div>
                <h2>Modal Content</h2>
                <p>This is dynamic content inside the modal.</p>
              </div>,
            )
          }
        >
          Open Modal
        </button>
        <ModalProvider />
      </div>
    );
  },
};
