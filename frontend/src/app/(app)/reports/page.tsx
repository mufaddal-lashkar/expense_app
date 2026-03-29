"use client";

import { useState } from "react";
import { Bot, Square, ChevronDown } from "lucide-react";
import { useSSEStream } from "@/hooks/useSSEStream";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

const MONTHS = Array.from({ length: 12 }, (_, i) => {
    const base = new Date();
    base.setDate(1); // 🔥 prevents month overflow bug
    base.setMonth(base.getMonth() - i);

    const month = String(base.getMonth() + 1).padStart(2, "0");
    const year = base.getFullYear();

    return {
        value: `${year}-${month}`,
        label: base.toLocaleString("default", { month: "long", year: "numeric" }),
    };
});

export default function ReportsPage() {
    const { organization } = useAuthStore();
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[0]!.value);
    const { data, isStreaming, error, startStream, stopStream } = useSSEStream();

    const handleGenerate = () => {
        startStream(`expenses/report/stream?month=${selectedMonth}`);
    };

    // Guard — employees cannot access reports
    if (organization?.role === "employee") {
        return (
            <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
                <Bot className="w-10 h-10 text-text-muted mb-4" />
                <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
                <p className="text-sm text-text-muted">
                    Only managers and admins can generate AI reports.
                </p>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-3xl">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-5 h-5 text-info" />
                    <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
                        AI Monthly Report
                    </h1>
                </div>
                <p className="text-sm text-text-muted">
                    Generate a real-time expense summary powered by AI. The report streams as it's generated.
                </p>
            </div>

            {/* Controls */}
            <div className="flex items-end gap-3 mb-6">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs text-text-muted">Select month</label>
                    <div className="relative">
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={isStreaming}
                            className="appearance-none pl-3 pr-8 py-2.5 text-sm rounded-lg bg-surface border border-border text-text outline-none focus:border-accent transition-all disabled:opacity-50"
                        >
                            {MONTHS.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    </div>
                </div>

                {!isStreaming ? (
                    <Button onClick={handleGenerate} disabled={!!data && !error}>
                        <Bot className="w-4 h-4" />
                        Generate report
                    </Button>
                ) : (
                    <Button variant="danger" onClick={stopStream}>
                        <Square className="w-4 h-4" />
                        Stop
                    </Button>
                )}

                {data && !isStreaming && (
                    <Button
                        variant="ghost"
                        onClick={() => startStream(`expenses/report/stream?month=${selectedMonth}`)}
                    >
                        Regenerate
                    </Button>
                )}
            </div>

            {/* Stream output */}
            {error && (
                <div className="p-4 rounded-xl bg-[#2a1a1a] border border-[#4a2a2a] text-sm text-danger">
                    {error}
                </div>
            )}

            {!data && !error && !isStreaming && (
                <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-2xl">
                    <Bot className="w-10 h-10 text-text-muted mb-3" />
                    <p className="text-sm text-text-muted">
                        Select a month and click Generate to start
                    </p>
                </div>
            )}

            {(data || isStreaming) && (
                <div className="rounded-2xl bg-surface border border-border overflow-hidden">
                    {/* Streaming indicator */}
                    {isStreaming && (
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-[#1a2a1a]">
                            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                            <span className="text-xs text-success font-medium">
                                Generating report...
                            </span>
                        </div>
                    )}

                    {/* Report content */}
                    <div className="p-8 prose-custom">
                        <ReactMarkdown
                            components={{
                                h1: ({ children }: { children?: ReactNode }) => <h1 className="text-3xl font-bold text-text mb-6 mt-2" style={{ fontFamily: 'var(--font-display)' }}>{children}</h1>,
                                h2: ({ children }: { children?: ReactNode }) => <h2 className="text-xl font-semibold text-text mb-4 mt-8 border-b border-border pb-2 capitalize tracking-tight">{children}</h2>,
                                h3: ({ children }: { children?: ReactNode }) => <h3 className="text-lg font-medium text-text mb-2 mt-6">{children}</h3>,
                                p: ({ children }: { children?: ReactNode }) => <p className="mb-4 last:mb-0 text-text-muted leading-relaxed">{children}</p>,
                                ul: ({ children }: { children?: ReactNode }) => <ul className="list-disc pl-5 mb-5 space-y-2">{children}</ul>,
                                ol: ({ children }: { children?: ReactNode }) => <ol className="list-decimal pl-5 mb-5 space-y-2">{children}</ol>,
                                li: ({ children }: { children?: ReactNode }) => <li className="text-text-muted text-sm">{children}</li>,
                                strong: ({ children }: { children?: ReactNode }) => <strong className="text-accent font-semibold">{children}</strong>,
                                hr: () => <hr className="my-8 border-border" />,
                                blockquote: ({ children }: { children?: ReactNode }) => <blockquote className="border-l-2 border-accent pl-4 italic my-6 text-text-muted bg-surface-2/50 py-2 rounded-r-lg">{children}</blockquote>,
                            }}
                        >
                            {data}
                        </ReactMarkdown>
                        {isStreaming && (
                            <span className="inline-block w-2 h-4 ml-1 bg-accent/50 animate-pulse align-middle" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}