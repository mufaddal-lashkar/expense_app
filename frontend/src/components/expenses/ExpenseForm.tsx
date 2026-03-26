"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { useExpenseStore } from "@/store/expenseStore";
import { ApiClientError } from "@/lib/api";
import type { Expense } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const CATEGORIES = [
    "travel", "meals", "accommodation", "software",
    "hardware", "office", "marketing", "training", "other",
] as const;

const RECEIPT_THRESHOLD = 100;

const schema = z
    .object({
        title: z.string().min(3, "At least 3 characters").max(100, "Max 100 characters"),
        description: z.string().max(500).optional(),
        amount: z.number({ error: "Amount is required" }).positive("Must be greater than 0").max(1_000_000),
        currency: z.string().length(3, "3-letter code e.g. USD"),
        category: z.enum(CATEGORIES, { error: "Select a category" }),
        merchantName: z.string().max(100).optional(),
        receiptUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
    })
    .refine(
        (d) => !(d.amount > RECEIPT_THRESHOLD && !d.receiptUrl),
        {
            message: `Receipt required for expenses over $${RECEIPT_THRESHOLD}`,
            path: ["receiptUrl"],
        }
    );

type FormData = z.infer<typeof schema>;

type Props = {
    mode: "create" | "edit";
    expense?: Expense;
};

export default function ExpenseForm({ mode, expense }: Props) {
    const router = useRouter();
    const { createExpense, updateExpense, isSubmitting } = useExpenseStore();
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setError,
        formState: { errors },
    } = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            title: expense?.title ?? "",
            description: expense?.description ?? "",
            amount: expense ? Number(expense.amount) : undefined,
            currency: expense?.currency ?? "USD",
            category: expense?.category,
            merchantName: expense?.merchantName ?? "",
            receiptUrl: expense?.receiptUrl ?? "",
        },
    });

    const amount = watch("amount");

    const onSubmit = async (data: FormData) => {
        setServerError(null);
        try {
            const payload = {
                ...data,
                amount: String(data.amount),
                receiptUrl: data.receiptUrl || undefined,
                description: data.description || undefined,
                merchantName: data.merchantName || undefined,
            };

            if (mode === "create") {
                const created = await createExpense(payload);
                router.push(`/expenses/${created.id}`);
            } else {
                await updateExpense(expense!.id, payload);
                router.push(`/expenses/${expense!.id}`);
            }
        } catch (err) {
            if (err instanceof ApiClientError) {
                if (err.details) {
                    err.details.forEach(({ field, message }) => {
                        setError(field as keyof FormData, { message });
                    });
                } else {
                    setServerError(err.message);
                }
            }
        }
    };

    return (
        <div className="p-8 max-w-2xl">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Back
            </button>

            <h1 className="text-3xl mb-8" style={{ fontFamily: "var(--font-display)" }}>
                {mode === "create" ? "New expense" : "Edit expense"}
            </h1>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
                <Input
                    label="Title"
                    placeholder="Team lunch, flight to NYC, etc."
                    error={errors.title?.message}
                    {...register("title")}
                />

                <div className="grid grid-cols-2 gap-4">
                    {/* Amount */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm text-[var(--color-text-muted)]">Amount</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            // ✅ Fix 1: valueAsNumber tells RHF to cast string → number before validation
                            // this is what makes z.number() work correctly with <input type="number">
                            {...register("amount", { valueAsNumber: true })}
                            className={cn(
                                "w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface-2)] border text-[var(--color-text)] text-sm placeholder:text-[#555] outline-none transition-all",
                                errors.amount
                                    ? "border-[var(--color-danger)]"
                                    : "border-[var(--color-border)] focus:border-[var(--color-accent)]"
                            )}
                        />
                        {errors.amount && (
                            <p className="text-xs text-[var(--color-danger)]">{errors.amount.message}</p>
                        )}
                    </div>

                    <Input
                        label="Currency"
                        placeholder="USD"
                        maxLength={3}
                        error={errors.currency?.message}
                        {...register("currency")}
                    />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-[var(--color-text-muted)]">Category</label>
                    <select
                        {...register("category")}
                        className={cn(
                            "w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface-2)] border text-[var(--color-text)] text-sm outline-none transition-all",
                            errors.category
                                ? "border-[var(--color-danger)]"
                                : "border-[var(--color-border)] focus:border-[var(--color-accent)]"
                        )}
                    >
                        <option value="">Select a category</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c} className="capitalize">{c}</option>
                        ))}
                    </select>
                    {errors.category && (
                        <p className="text-xs text-[var(--color-danger)]">{errors.category.message}</p>
                    )}
                </div>

                <Input
                    label="Merchant name (optional)"
                    placeholder="Delta Airlines, Whole Foods, etc."
                    error={errors.merchantName?.message}
                    {...register("merchantName")}
                />

                <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-[var(--color-text-muted)]">
                        Description <span className="text-[#555]">(optional)</span>
                    </label>
                    <textarea
                        {...register("description")}
                        placeholder="Additional details about this expense..."
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-sm placeholder:text-[#555] outline-none focus:border-[var(--color-accent)] transition-all resize-none"
                    />
                </div>

                <div
                    className={cn(
                        "rounded-xl p-4 border transition-all",
                        amount > RECEIPT_THRESHOLD
                            ? "border-[var(--color-warning)] bg-[#1f1a0a]"
                            : "border-[var(--color-border)] bg-transparent"
                    )}
                >
                    {amount > RECEIPT_THRESHOLD && (
                        <p className="text-xs text-[var(--color-warning)] mb-3 font-medium">
                            ⚠ Receipt required for expenses over ${RECEIPT_THRESHOLD}
                        </p>
                    )}
                    <Input
                        label={`Receipt URL${amount > RECEIPT_THRESHOLD ? " *" : " (optional)"}`}
                        placeholder="https://receipts.example.com/receipt.pdf"
                        error={errors.receiptUrl?.message}
                        {...register("receiptUrl")}
                    />
                </div>

                {serverError && (
                    <p className="text-sm text-[var(--color-danger)] bg-[#2a1a1a] border border-[#4a2a2a] rounded-lg px-4 py-3">
                        {serverError}
                    </p>
                )}

                <div className="flex gap-3 pt-2">
                    <Button type="button" variant="secondary" onClick={() => router.back()}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSubmitting} className="flex-1">
                        {mode === "create" ? "Create expense" : "Save changes"}
                    </Button>
                </div>
            </form>
        </div>
    );
}