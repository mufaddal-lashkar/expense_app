// Every API response goes through these helpers — no raw returns anywhere

export type ApiSuccess<T> = {
    success: true;
    data: T;
    message?: string;
};

export type ApiError = {
    success: false;
    error: {
        code: ErrorCode;
        message: string;
        details?: unknown;
    };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export type ErrorCode =
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "INVITE_EXPIRED"
    | "INVITE_ALREADY_USED"
    | "RATE_LIMITED"
    | "INTERNAL_ERROR";

export function ok<T>(data: T, message?: string): ApiSuccess<T> {
    return { success: true, data, ...(message ? { message } : {}) };
}

export function err(code: ErrorCode, message: string, details?: unknown): ApiError {
    return {
        success: false,
        error: { code, message, ...(details !== undefined ? { details } : {}) },
    };
}