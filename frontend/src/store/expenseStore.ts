import { create } from "zustand";
import {
    expensesApi,
    type Expense,
    type ExpenseWithNotes,
    type ExpenseFilters,
    type AiFlags,
} from "@/lib/api";
import { ApiClientError } from "@/lib/api";

type Pagination = {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
};

type ExpenseState = {
    // List state
    expenses: Expense[];
    pagination: Pagination | null;
    filters: ExpenseFilters;
    isListLoading: boolean;
    listError: string | null;

    // Detail state
    selectedExpense: ExpenseWithNotes | null;
    isDetailLoading: boolean;
    detailError: string | null;

    // Mutation loading states — track per action to show right spinner
    isSubmitting: boolean;
    isApproving: boolean;
    isRejecting: boolean;
    isReimbursing: boolean;
    isAnalyzing: boolean;
    isAddingNote: boolean;

    // Actions — List
    fetchExpenses: (filters?: ExpenseFilters) => Promise<void>;
    setFilters: (filters: Partial<ExpenseFilters>) => void;
    resetFilters: () => void;

    // Actions — Detail
    fetchExpense: (id: string) => Promise<void>;

    // Actions — CRUD
    createExpense: (data: Partial<Expense>) => Promise<Expense>;
    updateExpense: (id: string, data: Partial<Expense>) => Promise<void>;
    deleteExpense: (id: string) => Promise<void>;

    // Actions — Workflow
    submitExpense: (id: string) => Promise<void>;
    approveExpense: (id: string) => Promise<void>;
    rejectExpense: (id: string, reason: string) => Promise<void>;
    reimburseExpense: (id: string) => Promise<void>;

    // Actions — Notes + AI
    addNote: (expenseId: string, content: string) => Promise<void>;
    analyzeExpense: (id: string) => Promise<AiFlags>;

    clearErrors: () => void;
};

const DEFAULT_FILTERS: ExpenseFilters = {
    page: 1,
    limit: 20,
};

export const useExpenseStore = create<ExpenseState>()((set, get) => ({
    expenses: [],
    pagination: null,
    filters: DEFAULT_FILTERS,
    isListLoading: false,
    listError: null,

    selectedExpense: null,
    isDetailLoading: false,
    detailError: null,

    isSubmitting: false,
    isApproving: false,
    isRejecting: false,
    isReimbursing: false,
    isAnalyzing: false,
    isAddingNote: false,

    // List

    fetchExpenses: async (filters) => {
        const merged = { ...get().filters, ...filters };
        set({ isListLoading: true, listError: null, filters: merged });
        try {
            const result = await expensesApi.list(merged);
            set({ expenses: result.expenses, pagination: result.pagination, isListLoading: false });
        } catch (err) {
            const message = err instanceof ApiClientError ? err.message : "Failed to load expenses";
            set({ listError: message, isListLoading: false });
        }
    },

    setFilters: (filters) => {
        const merged = { ...get().filters, ...filters, page: 1 };
        set({ filters: merged });
        get().fetchExpenses(merged);
    },

    resetFilters: () => {
        set({ filters: DEFAULT_FILTERS });
        get().fetchExpenses(DEFAULT_FILTERS);
    },

    // Detail
    fetchExpense: async (id) => {
        set({ isDetailLoading: true, detailError: null, selectedExpense: null });
        try {
            const expense = await expensesApi.get(id);
            set({ selectedExpense: expense, isDetailLoading: false });
        } catch (err) {
            const message = err instanceof ApiClientError ? err.message : "Failed to load expense";
            set({ detailError: message, isDetailLoading: false });
        }
    },

    //CRUD
    createExpense: async (data) => {
        set({ isSubmitting: true });
        try {
            console.log("Log 1", data)
            const created = await expensesApi.create(data);
            // Prepend to list
            set((s) => ({ expenses: [created, ...s.expenses], isSubmitting: false }));
            return created;
        } catch (err) {
            set({ isSubmitting: false });
            throw err;
        }
    },

    updateExpense: async (id, data) => {
        set({ isSubmitting: true });
        try {
            const updated = await expensesApi.update(id, data);
            set((s) => ({
                expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
                selectedExpense: s.selectedExpense?.id === id
                    ? { ...s.selectedExpense, ...updated }
                    : s.selectedExpense,
                isSubmitting: false,
            }));
        } catch (err) {
            set({ isSubmitting: false });
            throw err;
        }
    },

    deleteExpense: async (id) => {
        set({ isSubmitting: true });
        try {
            await expensesApi.delete(id);
            set((s) => ({
                expenses: s.expenses.filter((e) => e.id !== id),
                isSubmitting: false,
            }));
        } catch (err) {
            set({ isSubmitting: false });
            throw err;
        }
    },

    // Workflow

    submitExpense: async (id) => {
        set({ isSubmitting: true });
        try {
            const updated = await expensesApi.submit(id);
            set((s) => ({
                expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
                selectedExpense: s.selectedExpense?.id === id
                    ? { ...s.selectedExpense, ...updated }
                    : s.selectedExpense,
                isSubmitting: false,
            }));
        } catch (err) {
            set({ isSubmitting: false });
            throw err;
        }
    },

    approveExpense: async (id) => {
        set({ isApproving: true });
        try {
            const updated = await expensesApi.approve(id);
            set((s) => ({
                expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
                selectedExpense: s.selectedExpense?.id === id
                    ? { ...s.selectedExpense, ...updated }
                    : s.selectedExpense,
                isApproving: false,
            }));
        } catch (err) {
            set({ isApproving: false });
            throw err;
        }
    },

    rejectExpense: async (id, reason) => {
        set({ isRejecting: true });
        try {
            const updated = await expensesApi.reject(id, reason);
            set((s) => ({
                expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
                selectedExpense: s.selectedExpense?.id === id
                    ? { ...s.selectedExpense, ...updated }
                    : s.selectedExpense,
                isRejecting: false,
            }));
        } catch (err) {
            set({ isRejecting: false });
            throw err;
        }
    },

    reimburseExpense: async (id) => {
        set({ isReimbursing: true });
        try {
            const updated = await expensesApi.reimburse(id);
            set((s) => ({
                expenses: s.expenses.map((e) => (e.id === id ? updated : e)),
                selectedExpense: s.selectedExpense?.id === id
                    ? { ...s.selectedExpense, ...updated }
                    : s.selectedExpense,
                isReimbursing: false,
            }));
        } catch (err) {
            set({ isReimbursing: false });
            throw err;
        }
    },

    // Notes + AI

    addNote: async (expenseId, content) => {
        set({ isAddingNote: true });
        try {
            const note = await expensesApi.addNote(expenseId, content);
            set((s) => ({
                selectedExpense: s.selectedExpense
                    ? { ...s.selectedExpense, notes: [...s.selectedExpense.notes, note] }
                    : null,
                isAddingNote: false,
            }));
        } catch (err) {
            set({ isAddingNote: false });
            throw err;
        }
    },

    analyzeExpense: async (id) => {
        set({ isAnalyzing: true });
        try {
            const flags = await expensesApi.analyze(id);
            set((s) => ({
                selectedExpense: s.selectedExpense
                    ? { ...s.selectedExpense, aiAnalyzed: true, aiFlags: flags }
                    : null,
                expenses: s.expenses.map((e) =>
                    e.id === id ? { ...e, aiAnalyzed: true, aiFlags: flags } : e
                ),
                isAnalyzing: false,
            }));
            return flags;
        } catch (err) {
            set({ isAnalyzing: false });
            throw err;
        }
    },

    clearErrors: () => set({ listError: null, detailError: null }),
}));