import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>

const TooltipContent = forwardRef<ElementRef<typeof TooltipPrimitive.Content>, TooltipContentProps>(
  (
    {
      className = '',
      side = 'top',
      sideOffset = 6,
      collisionPadding = 16,
      ...props
    },
    ref,
  ) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={`z-[250] max-w-[280px] rounded-xl border border-[#E5E7EB] bg-white px-[14px] py-3 text-left text-primary shadow-[0_4px_12px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)] outline-none ${className}`.trim()}
        {...props}
      />
    </TooltipPrimitive.Portal>
  ),
)
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
