import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser, AuthOrganization } from "@/lib/api";
import { authApi, setAuthToken } from "@/lib/api";

type AuthState = {
    user: AuthUser | null;
    organization: AuthOrganization | null;
    isLoading: boolean;
    error: string | null;

    // Actions
    login: (email: string, password: string) => Promise<{ hasOrg: boolean }>;
    signup: (email: string, username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchMe: () => Promise<void>;
    setOrganization: (org: AuthOrganization) => void;
    clearError: () => void;
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            organization: null,
            isLoading: false,
            error: null,

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const result = await authApi.login({ email, password });
                    setAuthToken(result.session.token);
                    set({
                        user: result.user,
                        organization: result.organization,
                        isLoading: false,
                    });
                    return { hasOrg: result.organization !== null };
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Login failed";
                    set({ error: message, isLoading: false });
                    throw err;
                }
            },

            signup: async (email, username, password) => {
                set({ isLoading: true, error: null });
                try {
                    await authApi.signup({ email, username, password });
                    set({ isLoading: false });
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : "Signup failed";
                    set({ error: message, isLoading: false });
                    throw err;
                }
            },

            logout: async () => {
                set({ isLoading: true });
                try {
                    await authApi.logout();
                } finally {
                    setAuthToken(null);
                    set({ user: null, organization: null, isLoading: false, error: null });
                }
            },

            fetchMe: async () => {
                set({ isLoading: true, error: null });
                try {
                    const result = await authApi.me();
                    set({ user: result.user, organization: result.organization, isLoading: false });
                } catch {
                    set({ user: null, organization: null, isLoading: false });
                }
            },

            setOrganization: (org) => set({ organization: org }),

            clearError: () => set({ error: null }),
        }),
        {
            name: "auth-storage",
            partialize: (state) => ({
                user: state.user,
                organization: state.organization,
            }),
        }
    )
);