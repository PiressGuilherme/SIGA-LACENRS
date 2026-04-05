import * as RadixTabs from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

export const Tabs        = RadixTabs.Root
export const TabsContent = RadixTabs.Content

export function TabsList({ className, children }) {
  return (
    <RadixTabs.List
      className={cn(
        'flex border-b-2 border-neutral-200',
        className
      )}
    >
      {children}
    </RadixTabs.List>
  )
}

export function TabsTrigger({ className, children, ...props }) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'flex-1 py-2.5 border-none bg-transparent cursor-pointer text-sm font-semibold',
        'text-neutral-400 border-b-2 border-transparent -mb-0.5',
        'transition-colors outline-none',
        'data-[state=active]:text-rs-red data-[state=active]:border-b-2 data-[state=active]:border-rs-red',
        'hover:text-neutral-600',
        'focus-visible:ring-2 focus-visible:ring-rs-red focus-visible:ring-offset-1',
        className
      )}
      {...props}
    >
      {children}
    </RadixTabs.Trigger>
  )
}
