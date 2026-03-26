import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
};

export function Input({ label, error, className, id, ...props }: InputProps) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <label htmlFor={inputId} className="text-sm text-text-muted">
                    {label}
                </label>
            )}
            <input
                id={inputId}
                {...props}
                className={cn(
                    "w-full px-3 py-2.5 rounded-lg bg-surface-2 border text-text text-sm placeholder:text-[#555] outline-none transition-all",
                    error
                        ? "border-danger focus:border-danger"
                        : "border-border focus:border-accent",
                    className
                )}
            />
            {error && <p className="text-xs text-danger">{error}</p>}
        </div>
    );
}