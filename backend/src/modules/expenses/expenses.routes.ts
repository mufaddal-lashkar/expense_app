import Elysia from "elysia";
import { db } from "../../db";
import { expenses, expenseNotes, users, memberships } from "../../db/schema";
import { eq, and, gte, lte, ilike, or, desc, count, sql } from "drizzle-orm";
import {
    createExpenseSchema,
    updateExpenseSchema,
    rejectExpenseSchema,
    addNoteSchema,
    listExpensesSchema,
    RECEIPT_THRESHOLD,
} from "./expenses.schemas";
import { isValidTransition } from "./expenses.transitions";
import { ok } from "../../lib/response";
import { Errors } from "../../middleware/errorHandler";
import { requireOrg } from "../../middleware/requireAuth";
import type { ExpenseStatus } from "./expenses.types";

export const expenseRoutes = new Elysia({ prefix: "/expenses" })
    .use(requireOrg)

    // GET /expenses
    .get("/", async ({ query, currentUser, currentOrgId, currentRole }) => {
        const parsed = listExpensesSchema.safeParse(query);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid query parameters",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const {
            status,
            category,
            submittedBy,
            dateFrom,
            dateTo,
            amountMin,
            amountMax,
            search,
            page,
            limit,
        } = parsed.data;

        const offset = (page - 1) * limit;

        // build condition query, orgid should be first
        const conditions = [
            eq(expenses.organizationId, currentOrgId),
        ];

        // employee can see only his own expenses
        if (currentRole === "employee") {
            conditions.push(eq(expenses.submittedBy, currentUser.id));
        }

        if (status) conditions.push(eq(expenses.status, status));
        if (category) conditions.push(eq(expenses.category, category));

        // Managers/admins can filter by submitter
        if (submittedBy && currentRole !== "employee") {
            conditions.push(eq(expenses.submittedBy, submittedBy));
        }

        if (dateFrom) {
            conditions.push(gte(expenses.createdAt, new Date(dateFrom)));
        }

        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            conditions.push(lte(expenses.createdAt, to));
        }

        if (amountMin !== undefined) {
            conditions.push(gte(expenses.amount, amountMin.toString()));
        }

        if (amountMax !== undefined) {
            conditions.push(lte(expenses.amount, amountMax.toString()));
        }

        if (search) {
            conditions.push(
                or(
                    ilike(expenses.title, `%${search}%`),
                    ilike(expenses.description, `%${search}%`),
                    ilike(expenses.merchantName, `%${search}%`)
                )!
            );
        }

        // fetch data and count in parallel
        const [rows, [countRow]] = await Promise.all([
            db
                .select({
                    id: expenses.id,
                    title: expenses.title,
                    amount: expenses.amount,
                    currency: expenses.currency,
                    category: expenses.category,
                    status: expenses.status,
                    merchantName: expenses.merchantName,
                    aiAnalyzed: expenses.aiAnalyzed,
                    aiFlags: expenses.aiFlags,
                    createdAt: expenses.createdAt,
                    updatedAt: expenses.updatedAt,
                    submittedBy: expenses.submittedBy,
                    submitterName: users.username,
                })
                .from(expenses)
                .innerJoin(users, eq(expenses.submittedBy, users.id))
                .where(and(...conditions))
                .orderBy(desc(expenses.createdAt))
                .limit(limit)
                .offset(offset),

            db
                .select({ total: count() })
                .from(expenses)
                .where(and(...conditions)),
        ]);

        const total = countRow?.total ?? 0;

        return ok({
            expenses: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: page * limit < total,
                hasPrev: page > 1,
            },
        });
    })

    // GET /expenses/:id
    .get("/:id", async ({ params, currentUser, currentOrgId, currentRole }) => {
        const [row] = await db
            .select({
                id: expenses.id,
                title: expenses.title,
                description: expenses.description,
                amount: expenses.amount,
                currency: expenses.currency,
                category: expenses.category,
                status: expenses.status,
                merchantName: expenses.merchantName,
                receiptUrl: expenses.receiptUrl,
                aiAnalyzed: expenses.aiAnalyzed,
                aiFlags: expenses.aiFlags,
                submittedBy: expenses.submittedBy,
                organizationId: expenses.organizationId,
                createdAt: expenses.createdAt,
                updatedAt: expenses.updatedAt,
                submitterName: users.username,
            })
            .from(expenses)
            .innerJoin(users, eq(expenses.submittedBy, users.id))
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!row) throw Errors.notFound("Expense");

        if (currentRole === "employee" && row.submittedBy !== currentUser.id) {
            throw Errors.forbidden();
        }

        const notes = await db
            .select({
                id: expenseNotes.id,
                content: expenseNotes.content,
                createdAt: expenseNotes.createdAt,
                userId: expenseNotes.userId,
                authorName: users.username,
            })
            .from(expenseNotes)
            .innerJoin(users, eq(expenseNotes.userId, users.id))
            .where(eq(expenseNotes.expenseId, params.id))
            .orderBy(desc(expenseNotes.createdAt));

        return ok({ ...row, notes });
    })

    // POST /expenses
    .post("/", async ({ body, currentUser, currentOrgId, set }) => {
        const parsed = createExpenseSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid expense data",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const [created] = await db
            .insert(expenses)
            .values({
                ...parsed.data,
                amount: parsed.data.amount.toString(),
                organizationId: currentOrgId,
                submittedBy: currentUser.id,
                status: "draft",
            })
            .returning();

        if (!created) throw Errors.internal("Failed to create expense");

        set.status = 201;
        return ok(created, "Expense created successfully");
    })

    // PATCH /expenses/:id
    .patch("/:id", async ({ params, body, currentUser, currentOrgId, currentRole }) => {
        const [existing] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!existing) throw Errors.notFound("Expense");

        if (existing.submittedBy !== currentUser.id && currentRole !== "admin") {
            throw Errors.forbidden("Only the expense owner can edit this expense");
        }

        if (existing.status !== "draft") {
            throw Errors.conflict("Expenses can only be edited while in draft status");
        }

        const parsed = updateExpenseSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid update data",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        // Re-check receipt threshold against merged amount
        const newAmount = parsed.data.amount ?? Number(existing.amount);
        const newReceiptUrl = parsed.data.receiptUrl ?? existing.receiptUrl;
        if (newAmount > RECEIPT_THRESHOLD && !newReceiptUrl) {
            throw Errors.validation(
                `Receipt URL is required for expenses over $${RECEIPT_THRESHOLD}`,
                [{ field: "receiptUrl", message: "Receipt URL is required" }]
            );
        }

        const { amount, ...rest } = parsed.data;
        const [updated] = await db
            .update(expenses)
            .set({
                ...rest,
                ...(amount !== undefined
                    ? { amount: amount.toString() }
                    : {}),
                updatedAt: new Date(),
            })
            .where(eq(expenses.id, params.id))
            .returning();

        if (!updated) throw Errors.internal("Failed to update expense");

        return ok(updated, "Expense updated successfully");
    })

    // DELETE /expenses/:id
    .delete("/:id", async ({ params, currentUser, currentOrgId, currentRole }) => {
        const [existing] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!existing) throw Errors.notFound("Expense");

        const isOwner = existing.submittedBy === currentUser.id;
        if (!isOwner && currentRole !== "admin") {
            throw Errors.forbidden("Only the expense owner or an admin can delete this expense");
        }

        if (existing.status !== "draft") {
            throw Errors.conflict("Expenses can only be deleted while in draft status");
        }

        await db.delete(expenses).where(eq(expenses.id, params.id));

        return ok(null, "Expense deleted successfully");
    })

    // POST /expenses/:id/submit
    .post("/:id/submit", async ({ params, currentUser, currentOrgId, currentRole }) => {
        const [existing] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!existing) throw Errors.notFound("Expense");

        if (existing.submittedBy !== currentUser.id) {
            throw Errors.forbidden("Only the expense owner can submit this expense");
        }

        if (!isValidTransition(existing.status as ExpenseStatus, "submitted", currentRole)) {
            throw Errors.conflict(
                `Cannot submit an expense with status "${existing.status}"`
            );
        }

        const [updated] = await db
            .update(expenses)
            .set({ status: "submitted", updatedAt: new Date() })
            .where(eq(expenses.id, params.id))
            .returning();

        return ok(updated, "Expense submitted for approval");
    })

    // POST /expenses/:id/approve
    .post("/:id/approve", async ({ params, currentOrgId, currentRole }) => {
        // Only manager or admin
        if (currentRole === "employee") throw Errors.forbidden();

        const [existing] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!existing) throw Errors.notFound("Expense");

        if (!isValidTransition(existing.status as ExpenseStatus, "approved", currentRole)) {
            throw Errors.conflict(
                `Cannot approve an expense with status "${existing.status}"`
            );
        }

        const [updated] = await db
            .update(expenses)
            .set({ status: "approved", updatedAt: new Date() })
            .where(eq(expenses.id, params.id))
            .returning();

        return ok(updated, "Expense approved");
    })

    // POST /expenses/:id/reject
    .post("/:id/reject", async ({ params, body, currentOrgId, currentRole, currentUser }) => {
        // Only manager or admin
        if (currentRole === "employee") throw Errors.forbidden();

        const parsed = rejectExpenseSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Rejection reason is required",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        const [existing] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!existing) throw Errors.notFound("Expense");

        if (!isValidTransition(existing.status as ExpenseStatus, "rejected", currentRole)) {
            throw Errors.conflict(
                `Cannot reject an expense with status "${existing.status}"`
            );
        }

        // Store rejection reason as a note and update status
        const [updated] = await db.transaction(async (tx) => {
            await tx.insert(expenseNotes).values({
                expenseId: params.id,
                userId: currentUser.id,
                content: `Rejected: ${parsed.data.reason}`,
            });

            return tx
                .update(expenses)
                .set({ status: "rejected", updatedAt: new Date() })
                .where(eq(expenses.id, params.id))
                .returning();
        });

        return ok(updated, "Expense rejected");
    })

    // POST /expenses/:id/reimburse
    .post("/:id/reimburse", async ({ params, currentOrgId, currentRole }) => {
        // Only admin
        if (currentRole !== "admin") throw Errors.forbidden("Only admins can reimburse expenses");

        const [existing] = await db
            .select()
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!existing) throw Errors.notFound("Expense");

        if (!isValidTransition(existing.status as ExpenseStatus, "reimbursed", currentRole)) {
            throw Errors.conflict(
                `Cannot reimburse an expense with status "${existing.status}"`
            );
        }

        const [updated] = await db
            .update(expenses)
            .set({ status: "reimbursed", updatedAt: new Date() })
            .where(eq(expenses.id, params.id))
            .returning();

        return ok(updated, "Expense marked as reimbursed");
    })

    // POST /expenses/:id/notes
    .post("/:id/notes", async ({ params, body, currentUser, currentOrgId, currentRole }) => {
        const parsed = addNoteSchema.safeParse(body);
        if (!parsed.success) {
            throw Errors.validation(
                "Invalid note",
                parsed.error.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
            );
        }

        // Verify expense exists and belongs to this org
        const [existing] = await db
            .select({ id: expenses.id, submittedBy: expenses.submittedBy })
            .from(expenses)
            .where(
                and(
                    eq(expenses.id, params.id),
                    eq(expenses.organizationId, currentOrgId)
                )
            )
            .limit(1);

        if (!existing) throw Errors.notFound("Expense");

        // Employees can only add notes to their own expenses
        if (currentRole === "employee" && existing.submittedBy !== currentUser.id) {
            throw Errors.forbidden("You can only add notes to your own expenses");
        }

        const [note] = await db
            .insert(expenseNotes)
            .values({
                expenseId: params.id,
                userId: currentUser.id,
                content: parsed.data.content,
            })
            .returning();

        if (!note) throw Errors.internal("Failed to add note");

        return ok(note, "Note added successfully");
    });