"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useExpenseStore } from "@/store/expenseStore";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const { selectedExpense, fetchExpense, isDetailLoading, detailError } = useExpenseStore();

  useEffect(() => {
    fetchExpense(id);
  }, [id]);

  if (isDetailLoading) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-8" />
        <div className="flex flex-col gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (detailError) return <ErrorMessage message={detailError} />;
  if (!selectedExpense) return null;

  return <ExpenseForm mode="edit" expense={selectedExpense} />;
}