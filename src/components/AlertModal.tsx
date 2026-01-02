import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

interface AlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  buttonLabel: string;
  onConfirm: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  buttonLabel,
  onConfirm,
}) => {
  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <TriangleAlert className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="mt-1">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AlertModal;
