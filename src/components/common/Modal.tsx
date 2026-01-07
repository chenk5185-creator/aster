import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // Aliases for simpler API
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  size = 'md',
}) => {
  // Support both API patterns
  const isModalOpen = open ?? isOpen ?? false;
  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen);
    if (!newOpen && onClose) onClose();
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
  };
  return (
    <Dialog.Root open={isModalOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-50 w-full translate-x-[-50%] translate-y-[-50%] rounded-xl border border-border bg-surface p-6 shadow-xl',
            sizeClasses[size],
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            className
          )}
        >
          {title && (
            <Dialog.Title className="text-lg font-semibold text-text-primary">
              {title}
            </Dialog.Title>
          )}
          {description && (
            <Dialog.Description className="mt-2 text-sm text-text-secondary">
              {description}
            </Dialog.Description>
          )}
          <div className={cn(title || description ? 'mt-4' : '')}>{children}</div>
          <Dialog.Close asChild>
            <button
              className="absolute right-4 top-4 rounded-lg p-1 text-text-muted hover:text-text-primary hover:bg-surface-light transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// Confirm modal for dangerous actions
interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  variant = 'danger',
  isLoading,
}) => {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => onOpenChange(false)}
          className="btn btn-secondary"
          disabled={isLoading}
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          className={cn(
            'btn',
            variant === 'danger' ? 'btn-danger' : 'bg-warning/20 text-warning border border-warning/30 hover:bg-warning/30'
          )}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : confirmText}
        </button>
      </div>
    </Modal>
  );
};
