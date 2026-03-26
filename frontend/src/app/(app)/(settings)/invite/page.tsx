"use client";

import { useState } from "react";
import { Copy, Check, Link2, Shield, Users, Clock } from "lucide-react";
import { orgsApi, ApiClientError } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

type Role = "manager" | "employee";

type GeneratedInvite = {
    inviteToken: string;
    expiresAt: string;
    role: Role;
};

const ROLE_CONFIG: Record<Role, { label: string; description: string; icon: typeof Shield; color: string }> = {
    manager: {
        label: "Manager",
        description: "Can approve, reject and analyze expenses across the org",
        icon: Shield,
        color: "text-info border-[#2a4a6a] bg-[#1a2a3a]",
    },
    employee: {
        label: "Employee",
        description: "Can create and submit their own expenses",
        icon: Users,
        color: "text-text-muted border-border bg-[var(--color-surface-2)]",
    },
};

export default function InvitePage() {
    const { organization } = useAuthStore();
    const [selectedRole, setSelectedRole] = useState<Role>("employee");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invite, setInvite] = useState<GeneratedInvite | null>(null);
    const [copied, setCopied] = useState(false);

    // Guard — only admins should reach this page
    if (organization?.role !== "admin") {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="w-14 h-14 rounded-full bg-[#2a1a1a] flex items-center justify-center mb-4">
                    <Shield className="w-7 h-7 text-danger" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
                <p className="text-sm text-text-muted">
                    Only admins can create invite links.
                </p>
            </div>
        );
    }

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setInvite(null);
        try {
            const result = await orgsApi.createInvite({ role: selectedRole });
            setInvite(result as GeneratedInvite);
        } catch (err) {
            setError(err instanceof ApiClientError ? err.message : "Failed to generate invite");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!invite) return;
        await navigator.clipboard.writeText(invite.inviteToken);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        setInvite(null);
        setError(null);
    };

    return (
        <div className="p-8 max-w-xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-text-muted text-sm mb-3">
                    <span>{organization.displayName}</span>
                    <span>/</span>
                    <span>Invite member</span>
                </div>
                <h1 className="text-3xl mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    Invite a member
                </h1>
                <p className="text-text-muted text-sm">
                    Generate a one-time invite token to share with a new team member.
                </p>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface border border-border mb-6">
                <Clock className="w-4 h-4 text-warning mt-0.5 flex-0" />
                <div className="text-sm text-text-muted">
                    Invite tokens expire after{" "}
                    <span className="text-text">24 hours</span> and can only be used{" "}
                    <span className="text-text">once</span>. Generate a new one for each person.
                </div>
            </div>

            {!invite ? (
                // Pick role + generate
                <div className="flex flex-col gap-6">
                    <div>
                        <p className="text-sm font-medium mb-3 text-text-muted">
                            Select role for the new member
                        </p>
                        <div className="flex flex-col gap-2">
                            {(Object.entries(ROLE_CONFIG) as [Role, typeof ROLE_CONFIG[Role]][]).map(
                                ([role, config]) => {
                                    const Icon = config.icon;
                                    const isSelected = selectedRole === role;
                                    return (
                                        <button
                                            key={role}
                                            onClick={() => setSelectedRole(role)}
                                            className={cn(
                                                "flex items-start gap-4 p-4 rounded-xl border text-left transition-all",
                                                isSelected
                                                    ? "border-accent bg-[#1a1f0a]"
                                                    : "border-border bg-surface hover:border-[#3e3e3e]"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "w-9 h-9 rounded-lg flex items-center justify-center flex-0 border",
                                                    isSelected ? "bg-[#1a1f0a] border-accent" : config.color
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        "w-4 h-4",
                                                        isSelected ? "text-accent" : ""
                                                    )}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium">{config.label}</p>
                                                    {isSelected && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-bg">
                                                            Selected
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-text-muted mt-0.5">
                                                    {config.description}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>

                    {error && (
                        <p className="text-sm text-danger bg-[#2a1a1a] border border-[#4a2a2a] rounded-lg px-4 py-3">
                            {error}
                        </p>
                    )}

                    <Button onClick={handleGenerate} isLoading={isLoading} size="lg" className="w-full">
                        <Link2 className="w-4 h-4" />
                        Generate invite token
                    </Button>
                </div>
            ) : (
                // Step 2: Show the token
                <div className="flex flex-col gap-4">
                    {/* Success state */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-[#1a2a1a] border border-[#2a4a2a]">
                        <div className="w-8 h-8 rounded-full bg-[#2a4a2a] flex items-center justify-center flex-0">
                            <Check className="w-4 h-4 text-success" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-success">
                                Invite token generated
                            </p>
                            <p className="text-xs text-text-muted mt-0.5">
                                Role:{" "}
                                <span className="text-text capitalize">{invite.role}</span>
                                {" · "}
                                Expires: <span className="text-text">{formatDate(invite.expiresAt)}</span>
                            </p>
                        </div>
                    </div>

                    {/* Token display */}
                    <div>
                        <p className="text-xs text-text-muted mb-2 font-medium uppercase tracking-wider">
                            Invite token
                        </p>
                        <div className="relative">
                            <div
                                className="w-full p-4 pr-14 rounded-xl bg-surface-2 border border-border font-mono text-xs text-text break-all leading-relaxed"
                                style={{ fontFamily: "var(--font-mono)" }}
                            >
                                {invite.inviteToken}
                            </div>
                            <button
                                onClick={handleCopy}
                                className={cn(
                                    "absolute top-1/2 right-3 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                    copied
                                        ? "bg-[#1a2a1a] text-success"
                                        : "bg-surface text-text-muted hover:text-text hover:bg-border"
                                )}
                                title="Copy token"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-text-muted mt-2">
                            Share this token with the invitee. They paste it in the onboarding screen.
                        </p>
                    </div>

                    {/* Instructions */}
                    <div className="p-4 rounded-xl bg-surface border border-border">
                        <p className="text-xs font-medium mb-3 text-text-muted uppercase tracking-wider">
                            How to use
                        </p>
                        <ol className="flex flex-col gap-2">
                            {[
                                "Share the token above with your new team member",
                                "They sign up or log in at localhost:3000",
                                "On the onboarding screen they pick 'Join with invite'",
                                "They paste the token and join with the role you selected",
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-3 text-xs text-text-muted">
                                    <span className="w-5 h-5 rounded-full bg-surface-2 border border-border flex items-center justify-center text-[10px] font-bold flex-0 mt-0.5">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </div>

                    <Button variant="secondary" onClick={handleReset} className="w-full">
                        Generate another invite
                    </Button>
                </div>
            )}
        </div>
    );
}