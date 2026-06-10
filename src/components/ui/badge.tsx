import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-primary border-primary/20",
        secondary: "border-transparent bg-muted/80 text-muted-foreground",
        destructive: "border-transparent bg-destructive/15 text-destructive border-destructive/20",
        outline: "text-foreground border-border/80 bg-transparent",
        success: "border-transparent bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        warning: "border-transparent bg-amber-500/10 text-amber-600 border-amber-500/20",
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };