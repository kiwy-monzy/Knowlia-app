import React from 'react';
import { Button } from '@/components/ui/button';

interface SimpleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
}

const SimpleDialog: React.FC<SimpleDialogProps> = ({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  children 
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <div className="mb-4">
          {children}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
};

// Simple dialog components for compatibility
const Dialog = {
  Root: SimpleDialog,
  Trigger: ({ children, onClick }: any) => (
    <div onClick={onClick}>{children}</div>
  ),
  Content: ({ children }: any) => <div>{children}</div>,
  Header: ({ children }: any) => <div className="mb-4">{children}</div>,
  Title: ({ children }: any) => <h2 className="text-lg font-semibold">{children}</h2>,
  Description: ({ children }: any) => <p className="text-sm text-gray-600 mt-1">{children}</p>,
  Footer: ({ children }: any) => <div className="flex justify-end gap-2">{children}</div>,
};

export { Dialog };
export default SimpleDialog;
