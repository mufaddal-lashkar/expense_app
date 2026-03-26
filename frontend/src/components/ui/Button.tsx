import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md" | "lg";
    isLoading?: boolean;
};

const variants = {
    primary: "bg-[var(--color-accent)] text-[var(--color-bg)] hover:bg-[var(--color-accent-hover)] font-semibold",
    secondary: "bg-[var(--color-surface-2)] text-[var(--color-text)] hover:bg-[#2e2e2e] border border-[var(--color-border)]",
    danger: "bg-transparent text-[var(--color-danger)] hover:bg-[#2a1a1a] border border-[var(--color-danger)]",
    ghost: "bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
};

const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
};

export function Button({
    variant = "primary",
    size = "md",
    isLoading,
    disabled,
    children,
    className,
    ...props
}: ButtonProps) {
    return (
        <button
            {...props}
            disabled={disabled ?? isLoading}
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                sizes[size],
                className
            )}
        >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
}