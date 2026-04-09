'use client';

import type { ComponentPropsWithoutRef } from 'react';

import styles from './Button.module.scss';

type ButtonVariant = 'primary' | 'secondary';

type ButtonProps = ComponentPropsWithoutRef<'button'> & {
  isLoading?: boolean;
  variant?: ButtonVariant;
};

function Button({
  children,
  className,
  disabled,
  isLoading = false,
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={[styles.button, styles[variant], className]
        .filter(Boolean)
        .join(' ')}
      data-test-id='button'
      disabled={disabled || isLoading}
      {...props}
    >
      {children}
    </button>
  );
}

Button.displayName = 'Button';

export { Button };
export type { ButtonProps, ButtonVariant };
