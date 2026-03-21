import { z } from "zod";

export const signupSchema = z.object({
    email: z
        .string({ error: "Email is required" })
        .email("Must be a valid email address")
        .max(255, "Email must be under 255 characters")
        .transform((v) => v.toLowerCase().trim()),

    username: z
        .string({ error: "Username is required" })
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must be under 30 characters")
        .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, hyphens")
        .transform((v) => v.toLowerCase().trim()),

    password: z
        .string({ error: "Password is required" })
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password must be under 128 characters"),
});

export const loginSchema = z.object({
    email: z
        .string({ error: "Email is required" })
        .email("Must be a valid email address")
        .transform((v) => v.toLowerCase().trim()),

    password: z
        .string({ error: "Password is required" })
        .min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;