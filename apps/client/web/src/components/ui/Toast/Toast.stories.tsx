import type { Meta, StoryObj } from '@storybook/react-vite';

import { useToastStore } from '../../../state/useToast';
import { ToastViewport } from './Toast';

const meta: Meta = {
  component: ToastViewport,
  title: 'UI/Toast',
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => {
    const addToast = useToastStore((s) => s.addToast);
    return (
      <div>
        <button onClick={() => addToast('Info toast')}>Add Info</button>
        <button onClick={() => addToast('Success!', 'success')}>
          Add Success
        </button>
        <button onClick={() => addToast('Error occurred', 'error')}>
          Add Error
        </button>
        <ToastViewport />
      </div>
    );
  },
};
