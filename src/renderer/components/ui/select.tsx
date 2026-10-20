import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

interface SelectTriggerProps extends SelectPrimitive.SelectTriggerProps {
  caretIcon?: boolean;
}

const SelectTrigger = ({ className, children, caretIcon = true, ...props }: SelectTriggerProps) => (
  <SelectPrimitive.Trigger
    className={cn(
      'inline-flex h-9 items-center justify-between gap-2 rounded-xl border border-border/40 bg-slate-950/70 px-3 text-sm text-slate-200 shadow-sm outline-none transition-colors hover:border-slate-600 focus:ring-2 focus:ring-blue-500/40 data-[placeholder]:text-slate-500',
      className,
    )}
    {...props}
  >
    {children}
    {caretIcon && (
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 ease-out data-[state=open]:rotate-180" />
      </SelectPrimitive.Icon>
    )}
  </SelectPrimitive.Trigger>
);

const SelectContent = ({
  className,
  children,
  position = 'popper',
  sideOffset = 6,
  onMouseEnter,
  onMouseLeave,
  ...props
}: SelectPrimitive.SelectContentProps) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      position={position}
      sideOffset={sideOffset}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        'z-[85] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl bg-slate-950/85 p-1 text-slate-200 shadow-2xl backdrop-blur-xl outline-none topcast-select-content glass-surface-elevated',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
);

const SelectItem = ({ className, children, ...props }: SelectPrimitive.SelectItemProps) => (
  <SelectPrimitive.Item
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none focus:bg-slate-800 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 transition-colors',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-blue-400" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
