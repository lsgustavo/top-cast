import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { cn } from '../../lib/utils';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = ({ className, ...props }: AlertDialogPrimitive.AlertDialogOverlayProps) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-[80] bg-slate-950/70 opacity-0 backdrop-blur-md transition-opacity duration-200 data-[state=open]:opacity-100 data-[state=closed]:opacity-0',
      className,
    )}
    {...props}
  />
);

const AlertDialogContent = ({
  className,
  onCloseAutoFocus,
  ...props
}: AlertDialogPrimitive.AlertDialogContentProps) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
        }
      }}
      className={cn(
        'fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 scale-95 rounded-2xl border border-border/40 bg-slate-900/95 p-0 text-slate-100 opacity-0 shadow-2xl backdrop-blur-xl outline-none transition duration-200 data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:scale-95 data-[state=closed]:opacity-0',
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
);

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className,
    )}
    {...props}
  />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = AlertDialogPrimitive.Title;
const AlertDialogDescription = AlertDialogPrimitive.Description;

const AlertDialogCancel = ({ className, ...props }: AlertDialogPrimitive.AlertDialogCancelProps) => (
  <AlertDialogPrimitive.Cancel
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-xl border border-border/40 bg-slate-900/60 px-4 text-xs font-medium text-slate-300 shadow-sm transition-all hover:bg-slate-800 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
);

const AlertDialogAction = ({ className, ...props }: AlertDialogPrimitive.AlertDialogActionProps) => (
  <AlertDialogPrimitive.Action
    className={cn(
      'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-600 px-4 text-xs font-medium text-white shadow-sm transition-all hover:bg-red-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
);

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
};
