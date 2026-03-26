"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Receipt, BarChart3, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/utils";

const NAV = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/expenses", icon: Receipt, label: "Expenses" },
    { href: "/reports", icon: BarChart3, label: "AI Report" },
    { href: "/invite", icon: Settings, label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, organization, logout, fetchMe } = useAuthStore();

    useEffect(() => {
        if (!user) {
            fetchMe().then(() => {
                const { user: u, organization: o } = useAuthStore.getState();
                if (!u) router.push("/login");
                else if (!o) router.push("/onboarding");
            });
        } else if (!organization) {
            router.push("/onboarding");
        }
    }, []);

    const handleLogout = async () => {
        await logout();
        router.push("/login");
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-56 flex-0 flex flex-col border-r border-border bg-surface">
                {/* Logo */}
                <div className="px-5 py-5 border-b border-border">
                    <span className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
                        Expensify
                    </span>
                </div>

                {/* Org badge */}
                {organization && (
                    <div className="px-4 py-3 border-b border-border">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-accent flex items-center justify-center text-[10px] font-bold text-bg">
                                {getInitials(organization.displayName)}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-medium truncate">{organization.displayName}</p>
                                <p className="text-[10px] text-text-muted capitalize">{organization.role}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
                    {NAV.map(({ href, icon: Icon, label }) => (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                                pathname.startsWith(href)
                                    ? "bg-accent text-bg font-medium"
                                    : "text-text-muted hover:text-text hover:bg-surface-2"
                            )}
                        >
                            <Icon className="w-4 h-4 flex-0" />
                            {label}
                        </Link>
                    ))}
                </nav>

                {/* User footer */}
                {user && (
                    <div className="p-3 border-t border-border">
                        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                            <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-medium">
                                {getInitials(user.username)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{user.username}</p>
                                <p className="text-[10px] text-text-muted truncate">{user.email}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-text-muted hover:text-danger hover:bg-[#2a1a1a] transition-all"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Sign out
                        </button>
                    </div>
                )}
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-y-auto bg-bg">
                {children}
            </main>
        </div>
    );
}