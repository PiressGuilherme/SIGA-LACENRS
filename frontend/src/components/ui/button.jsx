import { forwardRef } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-rs-red focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary:        'bg-rs-red text-white hover:bg-danger-700 active:bg-danger-800',
        secondary:      'bg-danger-50 text-rs-red hover:bg-danger-100 border border-danger-200',
        outline:        'border border-neutral-300 text-neutral-700 bg-white hover:bg-neutral-50',
        ghost:          'text-rs-red hover:bg-danger-50',
        danger:         'bg-danger-600 text-white hover:bg-danger-700',
        'danger-outline': 'border border-danger-300 text-danger-700 hover:bg-danger-50',
        neutral:        'bg-neutral-700 text-white hover:bg-neutral-800',
        success:        'bg-success-700 text-white hover:bg-success-800',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-sm',
        icon: 'p-2',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

const Button = forwardRef(function Button(
  { className, variant, size, loading = false, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
})

export { Button, buttonVariants }
export default Button
