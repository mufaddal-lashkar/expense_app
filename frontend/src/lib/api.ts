
import ky, { type KyResponse, HTTPError } from "ky";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Types
export type ApiSuccess<T> = {
    success: true;
    data: T;
    message?: string;
};

export type ApiError = {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Array<{ field: string; message: string }>;
    };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Api client error class

export class ApiClientError extends Error {
    constructor(
        public readonly code: string,
        message: string,
        public readonly status: number,
        public readonly details?: Array<{ field: string; message: string }>
    ) {
        super(message);
        this.name = "ApiClientError";
    }
}

// Token storage

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
    authToken = token;
    if (typeof window !== "undefined") {
        if (token) {
            localStorage.setItem("auth_token", token);
        } else {
            localStorage.removeItem("auth_token");
        }
    }
}

export function getAuthToken(): string | null {
    if (authToken) return authToken;
    if (typeof window !== "undefined") {
        authToken = localStorage.getItem("auth_token");
    }
    return authToken;
}

// Base client
const client = ky.create({
    prefixUrl: BASE_URL,
    credentials: "include",
    hooks: {
        beforeRequest: [
            (request) => {
                const token = getAuthToken();
                if (token) {
                    request.headers.set("Authorization", `Bearer ${token}`);
                }
            },
        ],
        afterResponse: [
            async (_request, _options, response) => {
                // 401 — clear token and redirect to login
                if (response.status === 401 && typeof window !== "undefined") {
                    setAuthToken(null);
                    window.location.href = "/login";
                }
            },
        ],
    },
});

// Core request helper
async function request<T>(
    method: "get" | "post" | "patch" | "delete",
    path: string,
    data?: unknown
): Promise<T> {
    try {
        const response: ApiResponse<T> = await client[method](path, {
            ...(data ? { json: data } : {}),
        }).json();

        if (!response.success) {
            throw new ApiClientError(
                response.error.code,
                response.error.message,
                400,
                response.error.details
            );
        }

        return response.data;
    } catch (error) {
        if (error instanceof ApiClientError) throw error;

        if (error instanceof HTTPError) {
            try {
                const body: ApiError = await error.response.json();
                throw new ApiClientError(
                    body.error.code,
                    body.error.message,
                    error.response.status,
                    body.error.details
                );
            } catch (parseError) {
                if (parseError instanceof ApiClientError) throw parseError;
                throw new ApiClientError("NETWORK_ERROR", "Network error occurred", 0);
            }
        }

        throw new ApiClientError("UNKNOWN_ERROR", "An unexpected error occurred", 0);
    }
}

// Auth API
export type AuthUser = {
    id: string;
    email: string;
    username: string;
};

export type AuthOrganization = {
    id: string;
    displayName: string;
    role: "admin" | "manager" | "employee";
};

export type LoginResponse = {
    user: AuthUser;
    session: { token: string };
    organization: AuthOrganization | null;
};

export type MeResponse = {
    user: AuthUser;
    organization: AuthOrganization | null;
};

export const authApi = {
    signup: (data: { email: string; username: string; password: string }) =>
        request<{ userId: string }>("post", "auth/signup", data),

    login: (data: { email: string; password: string }) =>
        request<LoginResponse>("post", "auth/login", data),

    logout: () => request<null>("post", "auth/logout"),

    me: () => request<MeResponse>("get", "auth/me"),
};

// Organizations API
export const orgsApi = {
    create: (data: { displayName: string }) =>
        request<{ organization: { id: string; displayName: string }; role: string }>(
            "post",
            "organizations/create",
            data
        ),

    createInvite: (data: { role: "manager" | "employee" }) =>
        request<{ inviteToken: string; expiresAt: string; role: string }>(
            "post",
            "organizations/invite",
            data
        ),

    join: (data: { token: string }) =>
        request<{ organization: { id: string; displayName: string }; role: string }>(
            "post",
            "organizations/join",
            data
        ),
};

// Expenses API
export type ExpenseStatus = "draft" | "submitted" | "approved" | "rejected" | "reimbursed";
export type ExpenseCategory =
    | "travel" | "meals" | "accommodation" | "software"
    | "hardware" | "office" | "marketing" | "training" | "other";

export type Expense = {
    id: string;
    title: string;
    description?: string;
    amount: string;
    currency: string;
    category: ExpenseCategory;
    status: ExpenseStatus;
    merchantName?: string;
    receiptUrl?: string;
    aiAnalyzed: boolean;
    aiFlags?: AiFlags | null;
    submittedBy: string;
    submitterName: string;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
};

export type ExpenseNote = {
    id: string;
    content: string;
    createdAt: string;
    userId: string;
    authorName: string;
};

export type AiFlags = {
    isAnomaly: boolean;
    flags: Array<{ type: string; severity: "low" | "medium" | "high"; message: string }>;
    confidenceScore: number;
    recommendation: "approve" | "review" | "reject";
};

export type ExpenseWithNotes = Expense & { notes: ExpenseNote[] };

export type PaginatedExpenses = {
    expenses: Expense[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
};

export type ExpenseFilters = {
    status?: ExpenseStatus;
    category?: ExpenseCategory;
    submittedBy?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: string;
    amountMax?: string;
    search?: string;
    page?: number;
    limit?: number;
};

export const expensesApi = {
    list: (filters: ExpenseFilters = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== "") params.set(k, String(v));
        });
        const query = params.toString();
        return request<PaginatedExpenses>("get", `expenses${query ? `?${query}` : ""}`);
    },

    get: (id: string) => request<ExpenseWithNotes>("get", `expenses/${id}`),

    create: (data: Partial<Expense>) => request<Expense>("post", "expenses", data),

    update: (id: string, data: Partial<Expense>) =>
        request<Expense>("patch", `expenses/${id}`, data),

    delete: (id: string) => request<null>("delete", `expenses/${id}`),

    submit: (id: string) => request<Expense>("post", `expenses/${id}/submit`),

    approve: (id: string) => request<Expense>("post", `expenses/${id}/approve`),

    reject: (id: string, reason: string) =>
        request<Expense>("post", `expenses/${id}/reject`, { reason }),

    reimburse: (id: string) => request<Expense>("post", `expenses/${id}/reimburse`),

    addNote: (id: string, content: string) =>
        request<ExpenseNote>("post", `expenses/${id}/notes`, { content }),

    analyze: (id: string) => request<AiFlags>("post", `expenses/${id}/analyze`),
};