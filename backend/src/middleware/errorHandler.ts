import Elysia from "elysia";
import { ZodError } from "zod";
import { err } from "../lib/response";

export const errorHandler = new Elysia({ name: "error-handler" }).onError(
    ({ code, error, set }) => {

        // Zod validation error (thrown manually from a route)
        if (error instanceof ZodError) {
            set.status = 400;
            return err("VALIDATION_ERROR", "Invalid input",
                error.issues.map((e) => ({
                    field: e.path.join("."),
                    message: e.message,
                }))
            );
        }

        // App-level errors we throw intentionally using AppError class
        if (error instanceof AppError) {
            set.status = error.statusCode;
            return err(error.code, error.message, error.details);
        }

        // Elysia built-in NOT_FOUND
        if (code === "NOT_FOUND") {
            set.status = 404;
            return err("NOT_FOUND", "The requested resource does not exist");
        }

        // Elysia built-in VALIDATION (from .body() inline schema)
        if (code === "VALIDATION") {
            set.status = 400;
            return err("VALIDATION_ERROR", "Invalid request data");
        }

        // Catch-all — never expose internal details
        console.error("[UNHANDLED ERROR]", error);
        set.status = 500;
        return err("INTERNAL_ERROR", "An unexpected error occurred");
    }
);

// ─── AppError — throw this anywhere in your route handlers ───────────────────

import type { ErrorCode } from "../lib/response";

export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: ErrorCode,
        message: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = "AppError";
    }
}

// Factory helpers so routes stay readable
export const Errors = {
    unauthorized: (msg = "Authentication required") =>
        new AppError(401, "UNAUTHORIZED", msg),

    forbidden: (msg = "You do not have permission to perform this action") =>
        new AppError(403, "FORBIDDEN", msg),

    notFound: (resource: string) =>
        new AppError(404, "NOT_FOUND", `${resource} not found`),

    conflict: (msg: string) =>
        new AppError(409, "CONFLICT", msg),

    inviteExpired: () =>
        new AppError(410, "INVITE_EXPIRED", "This invite link has expired"),

    inviteUsed: () =>
        new AppError(409, "INVITE_ALREADY_USED", "This invite link has already been used"),

    validation: (msg: string, details?: unknown) =>
        new AppError(400, "VALIDATION_ERROR", msg, details),

    internal: (msg = "An unexpected error occurred") =>
        new AppError(500, "INTERNAL_ERROR", msg),
};