import { cn } from "@/lib/utils";
import type { ExpenseStatus } from "@/lib/api";

const STATUS_CONFIG: Record<ExpenseStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-[#2a2a2a] text-[#888] border-[#3a3a3a]" },
    submitted: { label: "Submitted", className: "bg-[#1a2a3a] text-[#57c4ff] border-[#2a4a6a]" },
    approved: { label: "Approved", className: "bg-[#1a2a1a] text-[#57ff8f] border-[#2a4a2a]" },
    rejected: { label: "Rejected", className: "bg-[#2a1a1a] text-[#ff5757] border-[#4a2a2a]" },
    reimbursed: { label: "Reimbursed", className: "bg-[#2a2a1a] text-[#e8ff57] border-[#4a4a2a]" },
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
    const config = STATUS_CONFIG[status];
    return (
        <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border", config.className)}>
            {config.label}
        </span>
    );
}