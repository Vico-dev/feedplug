import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-steel focus:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-ink text-paper",
        secondary:
          "border-transparent bg-paper-2 text-ink-2",
        outline:
          "border-line text-ink-2 bg-transparent",
        success:
          "border-transparent bg-success-soft text-success",
        warning:
          "border-transparent bg-warning-soft text-warning",
        destructive:
          "border-transparent bg-danger-soft text-danger",
        error:
          "border-transparent bg-danger-soft text-danger",
        accent:
          "border-transparent bg-steel-soft text-steel",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }



