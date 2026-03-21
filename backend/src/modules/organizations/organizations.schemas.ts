import { z } from "zod";

export const createOrganizationSchema = z.object({
    displayName: z
        .string({ error: "Organization name is required" })
        .min(2, "Organization name must be at least 2 characters")
        .max(80, "Organization name must be under 80 characters")
        .trim(),
});

export const createInviteSchema = z.object({
    role: z.enum(["manager", "employee"], {
        message: "Role must be manager or employee",
    }),
});

// Role that admins can assign — admins cannot invite other admins
export const joinInviteSchema = z.object({
    token: z
        .string({ error: "Invite token is required" })
        .min(1, "Invite token cannot be empty"),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type JoinInviteInput = z.infer<typeof joinInviteSchema>;