import { z } from "zod";

const RECEIPT_REQUIRED_THRESHOLD = 100; // USD

// Create
export const createExpenseSchema = z
    .object({
        title: z
            .string({ error: "Title is required" })
            .min(3, "Title must be at least 3 characters")
            .max(100, "Title must be under 100 characters")
            .trim(),

        description: z
            .string()
            .max(500, "Description must be under 500 characters")
            .trim()
            .optional(),

        amount: z
            .union([z.number(), z.string()])
            .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
            .pipe(
                z
                    .number({ error: "Amount must be a number" })
                    .positive("Amount must be greater than 0")
                    .max(1_000_000, "Amount cannot exceed 1,000,000")
            ),

        currency: z
            .string()
            .length(3, "Currency must be a 3-letter code (e.g. USD)")
            .toUpperCase()
            .default("USD"),

        category: z.enum(
            ["travel", "meals", "accommodation", "software", "hardware", "office", "marketing", "training", "other"],
            { error: "Invalid expense category" }
        ),

        merchantName: z
            .string()
            .max(100, "Merchant name must be under 100 characters")
            .trim()
            .optional(),

        receiptUrl: z
            .string()
            .url("Receipt must be a valid URL")
            .optional(),
    })
    // Conditional: receipt required when amount > threshold
    .refine(
        (data) => {
            if (data.amount > RECEIPT_REQUIRED_THRESHOLD && !data.receiptUrl) {
                return false;
            }
            return true;
        },
        {
            message: `Receipt URL is required for expenses over $${RECEIPT_REQUIRED_THRESHOLD}`,
            path: ["receiptUrl"],
        }
    );

// Update
export const updateExpenseSchema = z
    .object({
        title: z
            .string()
            .min(3, "Title must be at least 3 characters")
            .max(100, "Title must be under 100 characters")
            .trim()
            .optional(),

        description: z
            .string()
            .max(500, "Description must be under 500 characters")
            .trim()
            .optional(),

        amount: z
            .union([z.number(), z.string()])
            .transform((v) => (typeof v === "string" ? parseFloat(v) : v))
            .pipe(
                z
                    .number()
                    .positive("Amount must be greater than 0")
                    .max(1_000_000, "Amount cannot exceed 1,000,000")
            )
            .optional(),

        currency: z
            .string()
            .length(3, "Currency must be a 3-letter code")
            .toUpperCase()
            .optional(),

        category: z
            .enum(
                ["travel", "meals", "accommodation", "software", "hardware", "office", "marketing", "training", "other"],
                { error: "Invalid expense category" }
            )
            .optional(),

        merchantName: z
            .string()
            .max(100, "Merchant name must be under 100 characters")
            .trim()
            .optional(),

        receiptUrl: z
            .string()
            .url("Receipt must be a valid URL")
            .optional(),
    })
    .refine(
        (data) => {
            // Only enforce if both amount and receiptUrl are being updated together
            if (data.amount && data.amount > RECEIPT_REQUIRED_THRESHOLD && !data.receiptUrl) {
                return false;
            }
            return true;
        },
        {
            message: `Receipt URL is required for expenses over $${RECEIPT_REQUIRED_THRESHOLD}`,
            path: ["receiptUrl"],
        }
    );

// Reject
export const rejectExpenseSchema = z.object({
    reason: z
        .string({ error: "Rejection reason is required" })
        .min(10, "Rejection reason must be at least 10 characters")
        .max(500, "Rejection reason must be under 500 characters")
        .trim(),
});

// Add Note
export const addNoteSchema = z.object({
    content: z
        .string({ error: "Note content is required" })
        .min(1, "Note cannot be empty")
        .max(1000, "Note must be under 1000 characters")
        .trim(),
});

// Filter query params
export const listExpensesSchema = z.object({
    status: z
        .enum(["draft", "submitted", "approved", "rejected", "reimbursed"])
        .optional(),

    category: z
        .enum(
            ["travel", "meals", "accommodation", "software", "hardware", "office", "marketing", "training", "other"]
        )
        .optional(),

    submittedBy: z
        .string()
        .uuid("submittedBy must be a valid user ID")
        .optional(),

    dateFrom: z
        .string()
        .date("dateFrom must be a valid date (YYYY-MM-DD)")
        .optional(),

    dateTo: z
        .string()
        .date("dateTo must be a valid date (YYYY-MM-DD)")
        .optional(),

    amountMin: z
        .string()
        .transform((v) => parseFloat(v))
        .pipe(z.number().positive("amountMin must be positive"))
        .optional(),

    amountMax: z
        .string()
        .transform((v) => parseFloat(v))
        .pipe(z.number().positive("amountMax must be positive"))
        .optional(),

    search: z
        .string()
        .max(100, "Search term must be under 100 characters")
        .trim()
        .optional(),

    page: z
        .string()
        .transform((v) => parseInt(v, 10))
        .pipe(z.number().int().min(1, "Page must be at least 1"))
        .default(1),

    limit: z
        .string()
        .transform((v) => parseInt(v, 10))
        .pipe(z.number().int().min(1).max(100, "Limit cannot exceed 100"))
        .default(20),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
export type AddNoteInput = z.infer<typeof addNoteSchema>;
export type ListExpensesInput = z.infer<typeof listExpensesSchema>;
export const RECEIPT_THRESHOLD = RECEIPT_REQUIRED_THRESHOLD;