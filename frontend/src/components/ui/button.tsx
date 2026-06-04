import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-sans text-sm font-semibold tracking-[-0.005em] transition-colors duration-base ease-ds focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-steel focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary CTA — near-black ink on paper. The DS reserves
        // steel-blue for the high-intent "accent" variant below.
        default:
          "bg-ink text-paper shadow-sm hover:bg-ink-2",
        accent:
          "bg-steel text-white shadow-sm hover:bg-steel-hover",
        destructive:
          "bg-danger text-white shadow-sm hover:bg-danger/90",
        outline:
          "border border-line bg-surface text-ink shadow-xs hover:bg-paper-2",
        secondary:
          "bg-paper-2 text-ink hover:bg-paper-3",
        ghost:
          "text-ink hover:bg-paper-2",
        link:
          "text-steel underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

// Note : on omet `variant` et `tone` du type HTML button parce que
// @shopify/app-bridge-types augmente globalement React.ButtonHTMLAttributes
// avec ses propres props (variant: "primary" | "breadcrumb", tone) destinées
// aux web-components ui-title-bar/ui-nav-menu. Sans ce Omit, le `variant`
// shadcn ("default" | "outline" | "ghost" | …) entre en collision.
export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "variant" | "tone">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }




