import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-gradient-primary text-white shadow-modern hover:shadow-elegant hover:scale-105 active:scale-95",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-modern hover:shadow-elegant",
        outline:
          "border border-border/50 bg-gradient-glass backdrop-blur-sm hover:bg-accent/10 hover:text-foreground shadow-subtle hover:shadow-modern",
        secondary:
          "bg-secondary/80 text-secondary-foreground hover:bg-secondary shadow-subtle hover:shadow-modern hover:scale-105",
        ghost: "hover:bg-muted hover:text-foreground focus:bg-muted/50 active:bg-muted rounded-lg",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary/80",
        glass: "bg-gradient-glass backdrop-blur-sm border border-border/30 text-foreground hover:bg-accent/20 shadow-glass hover:shadow-elegant",
      },
      size: {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-lg px-4",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
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
