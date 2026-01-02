import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from './SimpleDialog';

interface CloseAppButtonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CloseAppButton: React.FC<CloseAppButtonProps> = ({ open, onOpenChange }) => {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <Button variant="outline">Close App</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Close Application</Dialog.Title>
          <Dialog.Description>
            Are you sure you want to close the application? Any unsaved work will be lost.
          </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => window.close()}>
            Close
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
};

export default CloseAppButton;
