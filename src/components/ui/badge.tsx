import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary-hover shadow-subtle",
        secondary:
          "border-transparent bg-secondary/80 text-secondary-foreground hover:bg-secondary shadow-subtle",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-subtle",
        outline: "text-foreground border-border/50 bg-background/50 hover:bg-accent/20",
        success:
          "border-transparent bg-success/10 text-success border border-success/20",
        warning:
          "border-transparent bg-warning/10 text-warning border border-warning/20",
        danger:
          "border-transparent bg-danger/10 text-danger border border-danger/20 animate-pulse",
        approved:
          "border-transparent bg-success/10 text-success border border-success/20",
        pending:
          "border-transparent bg-warning/10 text-warning border border-warning/20",
        rejected:
          "border-transparent bg-danger/10 text-danger border border-danger/20",
        "high-risk":
          "border-transparent bg-danger/10 text-danger border border-danger/20 animate-pulse",
        "medium-risk":
          "border-transparent bg-warning/10 text-warning border border-warning/20",
        "low-risk":
          "border-transparent bg-success/10 text-success border border-success/20",
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
