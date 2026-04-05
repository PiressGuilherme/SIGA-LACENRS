import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'

export const SelectGroup = RadixSelect.Group
export const SelectValue = RadixSelect.Value

export function Select({ children, ...props }) {
  return <RadixSelect.Root {...props}>{children}</RadixSelect.Root>
}

export function SelectTrigger({ className, placeholder, children, ...props }) {
  return (
    <RadixSelect.Trigger
      className={cn(
        'flex w-full items-center justify-between rounded-lg border border-neutral-300 bg-white',
        'px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition-colors',
        'hover:border-neutral-400',
        'focus:border-rs-red focus:ring-1 focus:ring-rs-red',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[placeholder]:text-neutral-400',
        className
      )}
      {...props}
    >
      <RadixSelect.Value placeholder={placeholder} />
      <RadixSelect.Icon>
        <ChevronDown className="h-4 w-4 text-neutral-400 flex-shrink-0" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  )
}

export function SelectContent({ className, children, position = 'popper', ...props }) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        position={position}
        sideOffset={4}
        className={cn(
          'relative z-50 min-w-[8rem] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-md',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
          className
        )}
        {...props}
      >
        <RadixSelect.ScrollUpButton className="flex items-center justify-center py-1 text-neutral-400">
          <ChevronUp className="h-4 w-4" />
        </RadixSelect.ScrollUpButton>
        <RadixSelect.Viewport className="p-1">
          {children}
        </RadixSelect.Viewport>
        <RadixSelect.ScrollDownButton className="flex items-center justify-center py-1 text-neutral-400">
          <ChevronDown className="h-4 w-4" />
        </RadixSelect.ScrollDownButton>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  )
}

export function SelectItem({ className, children, ...props }) {
  return (
    <RadixSelect.Item
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-8 pr-3 text-sm',
        'text-neutral-700 outline-none transition-colors',
        'focus:bg-danger-50 focus:text-rs-red',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check className="h-4 w-4 text-rs-red" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  )
}

export function SelectLabel({ className, children, ...props }) {
  return (
    <RadixSelect.Label
      className={cn('py-1.5 pl-8 pr-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide', className)}
      {...props}
    >
      {children}
    </RadixSelect.Label>
  )
}

export function SelectSeparator({ className, ...props }) {
  return (
    <RadixSelect.Separator
      className={cn('-mx-1 my-1 h-px bg-neutral-200', className)}
      {...props}
    />
  )
}
