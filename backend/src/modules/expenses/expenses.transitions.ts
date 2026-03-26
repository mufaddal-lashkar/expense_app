import type { ExpenseStatus } from "./expenses.types";

// This file defines what transition the current user role make in the expense status

const TRANSITIONS: Record<ExpenseStatus, Partial<Record<ExpenseStatus, Array<"admin" | "manager" | "employee">>>> = {
    draft: {
        submitted: ["employee", "manager", "admin"],
    },
    submitted: {
        approved: ["manager", "admin"],
        rejected: ["manager", "admin"],
    },
    approved: {
        reimbursed: ["admin"],
        rejected: ["manager", "admin"],
    },
    rejected: {
        draft: ["employee", "manager", "admin"],
    },
    reimbursed: {
        // terminal state
    },
};

export function isValidTransition(
    from: ExpenseStatus,
    to: ExpenseStatus,
    role: "admin" | "manager" | "employee"
): boolean {
    const allowed = TRANSITIONS[from]?.[to];
    if (!allowed) return false;
    return allowed.includes(role);
}

export function getValidNextStatuses(
    from: ExpenseStatus,
    role: "admin" | "manager" | "employee"
): ExpenseStatus[] {
    const transitions = TRANSITIONS[from] ?? {};
    return (Object.entries(transitions) as [ExpenseStatus, string[]][])
        .filter(([, roles]) => roles.includes(role))
        .map(([status]) => status);
}