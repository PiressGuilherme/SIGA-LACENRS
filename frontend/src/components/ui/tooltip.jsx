import * as RadixTooltip from '@radix-ui/react-tooltip'
import { cn } from '../../lib/utils'

export const TooltipProvider = RadixTooltip.Provider
export const Tooltip         = RadixTooltip.Root
export const TooltipTrigger  = RadixTooltip.Trigger

export function TooltipContent({ className, sideOffset = 4, children, ...props }) {
  return (
    <RadixTooltip.Portal>
      <RadixTooltip.Content
        sideOffset={sideOffset}
        className={cn(
          'z-[9999] rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs text-white shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          'data-[side=bottom]:slide-in-from-top-2',
          'data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      >
        {children}
        <RadixTooltip.Arrow className="fill-neutral-900" />
      </RadixTooltip.Content>
    </RadixTooltip.Portal>
  )
}

/**
 * SimpleTooltip — wrapper conveniente para casos simples.
 *
 * <SimpleTooltip content="Texto do tooltip">
 *   <button>...</button>
 * </SimpleTooltip>
 */
export function SimpleTooltip({ content, children, side = 'top', delayDuration = 300 }) {
  if (!content) return children
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
