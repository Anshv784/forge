import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, mono, ...props }, ref) => {
    return (
      <input
        ref={ref}
        spellCheck={false}
        className={cn(
          "h-10 w-full min-w-0 rounded-[10px] border border-border bg-surface px-3.5 text-[13px] text-foreground outline-none placeholder:text-foreground-subtle",
          "transition-[border-color,box-shadow] duration-150 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-accent/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          mono && "font-mono",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-medium text-foreground-muted">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] leading-relaxed text-foreground-subtle">{hint}</span>}
    </label>
  );
}
