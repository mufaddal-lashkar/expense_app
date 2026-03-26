"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Building2, Link2, ArrowRight } from "lucide-react";
import { orgsApi, ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type View = "choose" | "create" | "join";

export default function OnboardingPage() {
    const router = useRouter();
    const { setOrganization } = useAuthStore();
    const [view, setView] = useState<View>("choose");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createForm = useForm<{ displayName: string }>();
    const joinForm = useForm<{ token: string }>();

    const handleCreate = async (data: { displayName: string }) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await orgsApi.create(data);
            setOrganization({
                id: result.organization.id,
                displayName: result.organization.displayName,
                role: result.role as "admin",
            });
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Failed to create organization");
            setIsLoading(false);
        }
    };

    const handleJoin = async (data: { token: string }) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await orgsApi.join(data);
            setOrganization({
                id: result.organization.id,
                displayName: result.organization.displayName,
                role: result.role as "employee" | "manager",
            });
            router.push("/dashboard");
        } catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Failed to join organization");
            setIsLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen grid place-items-center px-4"
            style={{ background: "radial-gradient(ellipse at top, #1a1f0a 0%, #0f0f0f 60%)" }}
        >
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-4xl mb-2" style={{ fontFamily: "var(--font-display)" }}>
                        Expensify
                    </h1>
                    <p className="text-text-muted text-sm">
                        {view === "choose"
                            ? "You're in. Now set up your workspace."
                            : view === "create"
                                ? "Create a new organization"
                                : "Join an existing organization"}
                    </p>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-8">
                    {view === "choose" && (
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => setView("create")}
                                className={cn(
                                    "group flex items-center gap-4 p-4 rounded-xl border transition-all",
                                    "border-border hover:border-accent hover:bg-[#1a1f0a]"
                                )}
                            >
                                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-accent" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-sm">Create organization</p>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        Start fresh as an admin
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                            </button>

                            <button
                                onClick={() => setView("join")}
                                className={cn(
                                    "group flex items-center gap-4 p-4 rounded-xl border transition-all",
                                    "border-border hover:border-accent hover:bg-[#1a1f0a]"
                                )}
                            >
                                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center">
                                    <Link2 className="w-5 h-5 text-info" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-medium text-sm">Join with invite</p>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        Use an invite token from your admin
                                    </p>
                                </div>
                                <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />
                            </button>
                        </div>
                    )}

                    {view === "create" && (
                        <form onSubmit={createForm.handleSubmit(handleCreate)} className="flex flex-col gap-4">
                            <Input
                                label="Organization name"
                                placeholder="Acme Corporation"
                                error={createForm.formState.errors.displayName?.message}
                                {...createForm.register("displayName", { required: "Name is required" })}
                            />
                            {error && (
                                <p className="text-sm text-danger bg-[#2a1a1a] border border-[#4a2a2a] rounded-lg px-3 py-2">
                                    {error}
                                </p>
                            )}
                            <div className="flex gap-2 mt-2">
                                <Button variant="ghost" type="button" onClick={() => { setView("choose"); setError(null); }}>
                                    Back
                                </Button>
                                <Button type="submit" isLoading={isLoading} className="flex-1">
                                    Create organization
                                </Button>
                            </div>
                        </form>
                    )}

                    {view === "join" && (
                        <form onSubmit={joinForm.handleSubmit(handleJoin)} className="flex flex-col gap-4">
                            <Input
                                label="Invite token"
                                placeholder="Paste your invite token here"
                                error={joinForm.formState.errors.token?.message}
                                {...joinForm.register("token", { required: "Token is required" })}
                            />
                            {error && (
                                <p className="text-sm text-danger bg-[#2a1a1a] border border-[#4a2a2a] rounded-lg px-3 py-2">
                                    {error}
                                </p>
                            )}
                            <div className="flex gap-2 mt-2">
                                <Button variant="ghost" type="button" onClick={() => { setView("choose"); setError(null); }}>
                                    Back
                                </Button>
                                <Button type="submit" isLoading={isLoading} className="flex-1">
                                    Join organization
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}