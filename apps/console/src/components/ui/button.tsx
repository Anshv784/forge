import { type ButtonHTMLAttributes, type MouseEvent, forwardRef, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

const variantStyles: Record<Variant, string> = {
  primary:
    "gradient-brand text-accent-foreground shadow-elevation-xs hover:shadow-elevation-glow hover:brightness-110 active:scale-[0.98] active:shadow-none",
  secondary:
    "bg-surface-raised text-foreground border border-border shadow-elevation-xs hover:border-accent/40 hover:shadow-elevation-sm active:scale-[0.98]",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-surface-raised hover:border-accent/40 active:scale-[0.98]",
  ghost: "bg-transparent text-foreground-muted hover:text-foreground hover:bg-surface-raised active:scale-[0.98]",
  danger:
    "bg-danger text-white shadow-elevation-xs hover:brightness-110 hover:shadow-elevation-sm active:scale-[0.98] active:shadow-none",
};

const sizeStyles: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-[13px] gap-2 rounded-[10px]",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

let rippleId = 0;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, onPointerDown, ...props }, ref) => {
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number; size: number }[]>([]);

    function spawnRipple(e: MouseEvent<HTMLButtonElement>) {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const id = ++rippleId;
      setRipples((prev) => [
        ...prev,
        { id, x: e.clientX - rect.left - size / 2, y: e.clientY - rect.top - size / 2, size },
      ]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 620);
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        onPointerDown={(e) => {
          if (!disabled && !loading) spawnRipple(e);
          onPointerDown?.(e);
        }}
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden font-medium tracking-[-0.006em] whitespace-nowrap",
          "transition-[background-color,color,transform,box-shadow,border-color,filter] duration-150 ease-out",
          "disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {ripples.map((r) => (
          <span
            key={r.id}
            aria-hidden
            className="animate-ripple pointer-events-none absolute rounded-full bg-white/40"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
          />
        ))}
        {loading ? (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
