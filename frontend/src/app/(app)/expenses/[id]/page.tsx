"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft, Pencil, Trash2, Send, CheckCircle2,
    XCircle, Banknote, Bot, MessageSquare, ExternalLink,
} from "lucide-react";
import { useExpenseStore } from "@/store/expenseStore";
import { useAuthStore } from "@/store/authStore";
import { ApiClientError } from "@/lib/api";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export default function ExpenseDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { organization, user } = useAuthStore();
    const {
        selectedExpense: expense,
        fetchExpense,
        isDetailLoading,
        detailError,
        submitExpense,
        approveExpense,
        rejectExpense,
        reimburseExpense,
        deleteExpense,
        addNote,
        analyzeExpense,
        isSubmitting,
        isApproving,
        isRejecting,
        isReimbursing,
        isAnalyzing,
        isAddingNote,
    } = useExpenseStore();

    const [noteContent, setNoteContent] = useState("");
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        fetchExpense(id);
    }, [id, fetchExpense]);

    if (isDetailLoading) {
        return (
            <div className="p-8 max-w-3xl">
                <div className="h-6 w-32 bg-surface rounded animate-pulse mb-8" />
                <div className="h-10 w-64 bg-surface rounded animate-pulse mb-4" />
                <div className="flex flex-col gap-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (detailError) return <ErrorMessage message={detailError} onRetry={() => fetchExpense(id)} />;
    if (!expense) return null;

    const role = organization?.role;
    const isOwner = expense.submittedBy === user?.id;
    const isDraft = expense.status === "draft";
    const isSubmitted = expense.status === "submitted";
    const isApproved = expense.status === "approved";

    const handleAction = async (action: () => Promise<void>) => {
        setActionError(null);
        try {
            await action();
        } catch (err) {
            setActionError(err instanceof ApiClientError ? err.message : "Action failed");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this expense? This cannot be undone.")) return;
        await handleAction(async () => {
            await deleteExpense(expense.id);
            router.push("/expenses");
        });
    };

    const handleReject = async () => {
        if (rejectReason.trim().length < 10) return;
        await handleAction(async () => {
            await rejectExpense(expense.id, rejectReason);
            setShowRejectModal(false);
            setRejectReason("");
        });
    };

    const handleAddNote = async () => {
        if (!noteContent.trim()) return;
        await handleAction(async () => {
            await addNote(expense.id, noteContent.trim());
            setNoteContent("");
        });
    };

    return (
        <div className="p-8 max-w-3xl">
            {/* Back */}
            <button
                onClick={() => router.push("/expenses")}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-text mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                All expenses
            </button>

            {/* Title row */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
                            {expense.title}
                        </h1>
                        <StatusBadge status={expense.status} />
                    </div>
                    <p className="text-sm text-text-muted">
                        Submitted by <span className="text-text">{expense.submitterName}</span>
                        {" · "}{formatDate(expense.createdAt)}
                    </p>
                </div>

                {/* Owner actions — draft only */}
                {isOwner && isDraft && (
                    <div className="flex items-center gap-2 flex-0">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => router.push(`/expenses/${expense.id}/edit`)}
                        >
                            <Pencil className="w-4 h-4" /> Edit
                        </Button>
                        <Button variant="danger" size="sm" isLoading={isSubmitting} onClick={handleDelete}>
                            <Trash2 className="w-4 h-4" /> Delete
                        </Button>
                    </div>
                )}
            </div>

            {actionError && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-[#2a1a1a] border border-[#4a2a2a] text-sm text-danger">
                    {actionError}
                </div>
            )}

            {/* Details card */}
            <div className="rounded-2xl bg-surface border border-border p-6 mb-6">
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                    <Detail
                        label="Amount"
                        value={
                            <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)" }}>
                                {formatCurrency(expense.amount, expense.currency)}
                            </span>
                        }
                    />
                    <Detail label="Category" value={<span className="capitalize">{expense.category}</span>} />
                    {expense.merchantName && <Detail label="Merchant" value={expense.merchantName} />}
                    {expense.receiptUrl && (
                        <Detail
                            label="Receipt"
                            value={
                                <a
                                    href={expense.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-accent hover:underline text-sm"
                                >
                                    View receipt <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            }
                        />
                    )}
                    {expense.description && (
                        <div className="col-span-2">
                            <Detail label="Description" value={expense.description} />
                        </div>
                    )}
                </div>
            </div>

            {/* AI Analysis */}
            <div className="rounded-2xl bg-surface border border-border p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-info" />
                        <h2 className="text-sm font-semibold">AI Analysis</h2>
                    </div>
                    {(role === "manager" || role === "admin") && !expense.aiAnalyzed && (
                        <Button
                            variant="secondary"
                            size="sm"
                            isLoading={isAnalyzing}
                            onClick={() => handleAction(() => analyzeExpense(expense.id).then(() => { }))}
                        >
                            <Bot className="w-4 h-4" /> Analyze
                        </Button>
                    )}
                </div>

                {!expense.aiAnalyzed ? (
                    <p className="text-sm text-text-muted">
                        No analysis yet.{" "}
                        {role !== "employee" ? "Click Analyze to run AI anomaly detection." : ""}
                    </p>
                ) : expense.aiFlags ? (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border",
                                expense.aiFlags.isAnomaly
                                    ? "bg-[#2a1a1a] border-[#4a2a2a] text-danger"
                                    : "bg-[#1a2a1a] border-[#2a4a2a] text-success"
                            )}>
                                {expense.aiFlags.isAnomaly ? (
                                    <XCircle className="w-4 h-4" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                {expense.aiFlags.isAnomaly ? "Anomaly detected" : "No anomalies"}
                            </div>
                            <span className="text-xs text-text-muted">
                                Confidence: {Math.round(expense.aiFlags.confidenceScore * 100)}%
                            </span>
                            <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full font-medium capitalize border",
                                expense.aiFlags.recommendation === "approve"
                                    ? "bg-[#1a2a1a] text-success border-[#2a4a2a]"
                                    : expense.aiFlags.recommendation === "reject"
                                        ? "bg-[#2a1a1a] text-danger border-[#4a2a2a]"
                                        : "bg-[#1a2a1a] text-warning border-[#2a3a1a]"
                            )}>
                                {expense.aiFlags.recommendation}
                            </span>
                        </div>

                        {expense.aiFlags.flags.length > 0 && (
                            <div className="flex flex-col gap-2">
                                {expense.aiFlags.flags.map((flag, i) => (
                                    <div key={i} className="flex items-start gap-2 text-sm text-text-muted bg-surface-2 rounded-lg px-3 py-2">
                                        <span className={cn(
                                            "text-xs px-1.5 py-0.5 rounded font-medium mt-0.5",
                                            flag.severity === "high" ? "bg-[#4a2a2a] text-danger"
                                                : flag.severity === "medium" ? "bg-[#3a2a1a] text-warning"
                                                    : "bg-[#2a2a2a] text-text-muted"
                                        )}>
                                            {flag.severity}
                                        </span>
                                        {flag.message}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Workflow actions */}
            {(role === "manager" || role === "admin" || (isOwner && isDraft)) && (
                <div className="rounded-2xl bg-surface border border-border p-6 mb-6">
                    <h2 className="text-sm font-semibold mb-4">Actions</h2>
                    <div className="flex flex-wrap gap-2">
                        {/* Submit — owner + draft */}
                        {isOwner && isDraft && (
                            <Button
                                size="sm"
                                isLoading={isSubmitting}
                                onClick={() => handleAction(() => submitExpense(expense.id))}
                            >
                                <Send className="w-4 h-4" /> Submit for approval
                            </Button>
                        )}

                        {/* Approve — manager/admin + submitted */}
                        {(role === "manager" || role === "admin") && isSubmitted && (
                            <Button
                                size="sm"
                                isLoading={isApproving}
                                onClick={() => handleAction(() => approveExpense(expense.id))}
                            >
                                <CheckCircle2 className="w-4 h-4" /> Approve
                            </Button>
                        )}

                        {/* Reject — manager/admin + submitted or approved */}
                        {(role === "manager" || role === "admin") && (isSubmitted || isApproved) && (
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setShowRejectModal(true)}
                            >
                                <XCircle className="w-4 h-4" /> Reject
                            </Button>
                        )}

                        {/* Reimburse — admin + approved */}
                        {role === "admin" && isApproved && (
                            <Button
                                variant="secondary"
                                size="sm"
                                isLoading={isReimbursing}
                                onClick={() => handleAction(() => reimburseExpense(expense.id))}
                            >
                                <Banknote className="w-4 h-4" /> Mark as reimbursed
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Notes thread */}
            <div className="rounded-2xl bg-surface border border-border p-6">
                <div className="flex items-center gap-2 mb-5">
                    <MessageSquare className="w-4 h-4 text-text-muted" />
                    <h2 className="text-sm font-semibold">
                        Notes{expense.notes.length > 0 && ` · ${expense.notes.length}`}
                    </h2>
                </div>

                {expense.notes.length === 0 ? (
                    <p className="text-sm text-text-muted mb-5">No notes yet.</p>
                ) : (
                    <div className="flex flex-col gap-3 mb-5">
                        {expense.notes.map((note) => (
                            <div key={note.id} className="flex gap-3">
                                <div className="w-7 h-7 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-medium flex-0 mt-0.5">
                                    {note.authorName.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium">{note.authorName}</span>
                                        <span className="text-xs text-text-muted">
                                            {formatDate(note.createdAt)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap">
                                        {note.content}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Add note */}
                <div className="flex gap-2">
                    <textarea
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Add a note..."
                        rows={2}
                        className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface-2 border border-border text-text placeholder:text-[#555] outline-none focus:border-accent transition-all resize-none"
                    />
                    <Button
                        size="sm"
                        variant="secondary"
                        isLoading={isAddingNote}
                        disabled={!noteContent.trim()}
                        onClick={handleAddNote}
                        className="self-end"
                    >
                        Post
                    </Button>
                </div>
            </div>

            {/* Reject modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-surface border border-border rounded-2xl p-6">
                        <h2 className="text-lg font-semibold mb-1">Reject expense</h2>
                        <p className="text-sm text-text-muted mb-5">
                            Provide a reason so the employee can revise and resubmit.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (min. 10 characters)..."
                            rows={4}
                            className="w-full px-3 py-2.5 text-sm rounded-lg bg-surface-2 border border-border text-text placeholder:text-[#555] outline-none focus:border-accent transition-all resize-none mb-4"
                        />
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="ghost"
                                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                isLoading={isRejecting}
                                disabled={rejectReason.trim().length < 10}
                                onClick={handleReject}
                            >
                                <XCircle className="w-4 h-4" /> Confirm rejection
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs text-text-muted mb-1 uppercase tracking-wider">{label}</p>
            <div className="text-sm text-text">{value}</div>
        </div>
    );
}