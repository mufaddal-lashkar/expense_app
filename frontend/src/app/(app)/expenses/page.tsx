"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { useExpenseStore } from "@/store/expenseStore";
import { useAuthStore } from "@/store/authStore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { ExpenseCategory, ExpenseStatus } from "@/lib/api";

const CATEGORIES: ExpenseCategory[] = [
    "travel", "meals", "accommodation", "software",
    "hardware", "office", "marketing", "training", "other",
];

const STATUSES: ExpenseStatus[] = [
    "draft", "submitted", "approved", "rejected", "reimbursed",
];

export default function ExpensesPage() {
    const router = useRouter();
    const { organization } = useAuthStore();
    const {
        expenses,
        pagination,
        filters,
        isListLoading,
        listError,
        fetchExpenses,
        setFilters,
        resetFilters,
    } = useExpenseStore();

    const [showFilters, setShowFilters] = useState(false);
    const [searchValue, setSearchValue] = useState(filters.search ?? "");

    useEffect(() => {
        fetchExpenses();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchValue !== filters.search) {
                setFilters({ search: searchValue || undefined });
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchValue]);

    const hasActiveFilters =
        filters.status || filters.category || filters.search ||
        filters.dateFrom || filters.dateTo || filters.amountMin || filters.amountMax;

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl mb-1" style={{ fontFamily: "var(--font-display)" }}>
                        Expenses
                    </h1>
                    <p className="text-sm text-[var(--color-text-muted)]">
                        {pagination
                            ? `${pagination.total} expense${pagination.total !== 1 ? "s" : ""} total`
                            : "Loading..."}
                    </p>
                </div>
                <Button onClick={() => router.push("/expenses/new")}>
                    <Plus className="w-4 h-4" />
                    New expense
                </Button>
            </div>

            {/* Search + filter bar */}
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        placeholder="Search expenses..."
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[#555] outline-none focus:border-[var(--color-accent)] transition-all"
                    />
                    {searchValue && (
                        <button
                            onClick={() => { setSearchValue(""); setFilters({ search: undefined }); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowFilters((v) => !v)}
                    className={cn(showFilters && "border-[var(--color-accent)] text-[var(--color-accent)]")}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {hasActiveFilters && (
                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                    )}
                </Button>

                {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                        <X className="w-3.5 h-3.5" /> Clear
                    </Button>
                )}
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 mb-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
                    {/* Status */}
                    <div>
                        <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Status</label>
                        <select
                            value={filters.status ?? ""}
                            onChange={(e) => setFilters({ status: (e.target.value as ExpenseStatus) || undefined })}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                        >
                            <option value="">All statuses</option>
                            {STATUSES.map((s) => (
                                <option key={s} value={s} className="capitalize">{s}</option>
                            ))}
                        </select>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Category</label>
                        <select
                            value={filters.category ?? ""}
                            onChange={(e) => setFilters({ category: (e.target.value as ExpenseCategory) || undefined })}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                        >
                            <option value="">All categories</option>
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c} className="capitalize">{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date from */}
                    <div>
                        <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">From</label>
                        <input
                            type="date"
                            value={filters.dateFrom ?? ""}
                            onChange={(e) => setFilters({ dateFrom: e.target.value || undefined })}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>

                    {/* Date to */}
                    <div>
                        <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">To</label>
                        <input
                            type="date"
                            value={filters.dateTo ?? ""}
                            onChange={(e) => setFilters({ dateTo: e.target.value || undefined })}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>

                    {/* Amount min */}
                    <div>
                        <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Min amount</label>
                        <input
                            type="number"
                            placeholder="0"
                            value={filters.amountMin ?? ""}
                            onChange={(e) => setFilters({ amountMin: e.target.value || undefined })}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>

                    {/* Amount max */}
                    <div>
                        <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Max amount</label>
                        <input
                            type="number"
                            placeholder="10000"
                            value={filters.amountMax ?? ""}
                            onChange={(e) => setFilters({ amountMax: e.target.value || undefined })}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                        />
                    </div>
                </div>
            )}

            {/* States */}
            {isListLoading && (
                <div className="flex flex-col gap-2">
                    {[...Array(6)].map((_, i) => (
                        <div
                            key={i}
                            className="h-16 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] animate-pulse"
                        />
                    ))}
                </div>
            )}

            {!isListLoading && listError && (
                <ErrorMessage message={listError} onRetry={fetchExpenses} />
            )}

            {!isListLoading && !listError && expenses.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center mb-4">
                        <Plus className="w-7 h-7 text-[var(--color-text-muted)]" />
                    </div>
                    <p className="font-medium mb-1">No expenses yet</p>
                    <p className="text-sm text-[var(--color-text-muted)] mb-4">
                        {hasActiveFilters ? "No expenses match your filters." : "Create your first expense to get started."}
                    </p>
                    {!hasActiveFilters && (
                        <Button size="sm" onClick={() => router.push("/expenses/new")}>
                            <Plus className="w-4 h-4" /> New expense
                        </Button>
                    )}
                </div>
            )}

            {!isListLoading && !listError && expenses.length > 0 && (
                <>
                    {/* Table */}
                    <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                            <span>Expense</span>
                            <span>Amount</span>
                            <span>Category</span>
                            <span>Status</span>
                            <span>Date</span>
                        </div>

                        {expenses.map((expense) => (
                            <div
                                key={expense.id}
                                onClick={() => router.push(`/expenses/${expense.id}`)}
                                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] px-4 py-3.5 border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)] cursor-pointer transition-colors group"
                            >
                                {/* Title + submitter */}
                                <div className="min-w-0 pr-4">
                                    <p className="text-sm font-medium truncate group-hover:text-[var(--color-accent)] transition-colors">
                                        {expense.title}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                        {organization?.role !== "employee" ? expense.submitterName : expense.merchantName ?? "—"}
                                    </p>
                                </div>

                                {/* Amount */}
                                <div className="flex items-center">
                                    <span className="text-sm font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                                        {formatCurrency(expense.amount, expense.currency)}
                                    </span>
                                </div>

                                {/* Category */}
                                <div className="flex items-center">
                                    <span className="text-sm capitalize text-[var(--color-text-muted)]">
                                        {expense.category}
                                    </span>
                                </div>

                                {/* Status */}
                                <div className="flex items-center">
                                    <StatusBadge status={expense.status} />
                                </div>

                                {/* Date */}
                                <div className="flex items-center">
                                    <span className="text-xs text-[var(--color-text-muted)]">
                                        {formatDate(expense.createdAt)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 text-sm">
                            <p className="text-[var(--color-text-muted)]">
                                Showing {(pagination.page - 1) * pagination.limit + 1}–
                                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                                {pagination.total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={!pagination.hasPrev}
                                    onClick={() => setFilters({ page: pagination.page - 1 })}
                                >
                                    Previous
                                </Button>
                                <span className="text-[var(--color-text-muted)] text-xs px-2">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    disabled={!pagination.hasNext}
                                    onClick={() => setFilters({ page: pagination.page + 1 })}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}