import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '../../lib/utils';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = ({ className, ...props }: AlertDialogPrimitive.AlertDialogOverlayProps) => (
  <AlertDialogPrimitive.Overlay
    className={cn('fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out', className)}
    {...props}
  />
);

const AlertDialogContent = ({ className, ...props }: AlertDialogPrimitive.AlertDialogContentProps) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      className={cn('fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl', className)}
      {...props}
    />
  </AlertDialogPortal>
);

const AlertDialogTitle = AlertDialogPrimitive.Title;
const AlertDialogDescription = AlertDialogPrimitive.Description;
const AlertDialogCancel = ({ className, ...props }: AlertDialogPrimitive.AlertDialogCancelProps) => (
  <AlertDialogPrimitive.Cancel
    className={cn('inline-flex h-9 items-center justify-center rounded-md border border-slate-700 px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50', className)}
    {...props}
  />
);
const AlertDialogAction = ({ className, ...props }: AlertDialogPrimitive.AlertDialogActionProps) => (
  <AlertDialogPrimitive.Action
    className={cn('inline-flex h-9 items-center justify-center gap-2 rounded-md bg-red-600 px-3 text-sm font-medium text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50', className)}
    {...props}
  />
);

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
};
